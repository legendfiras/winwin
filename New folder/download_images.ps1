[CmdletBinding()]
param(
    [string]$InputFile = "",
    [string]$OutputDirectory = "downloaded_images",
    [int]$RetryCount = 3
)

$ErrorActionPreference = "Stop"

$inputLines = @()
$isCsv = $false
if ($InputFile) {
    if (-not (Test-Path -LiteralPath $InputFile)) {
        throw "Input file not found: $InputFile"
    }
    $inputLines = Get-Content -LiteralPath $InputFile | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') }
    $isCsv = [IO.Path]::GetExtension($InputFile).ToLowerInvariant() -eq '.csv'
} else {
    $clipboard = Get-Clipboard -Raw -ErrorAction SilentlyContinue
    if ($clipboard) {
        $inputLines = $clipboard -split "`r?`n"
    }
}

$urls = @()

if ($isCsv) {
    $rows = Import-Csv -LiteralPath $InputFile
    $column = $rows[0].PSObject.Properties.Name | Where-Object { $_ -ieq 'image_url' -or $_ -ieq 'url' } | Select-Object -First 1
    if (-not $column) {
        throw "CSV must contain an image_url or url column."
    }
    $urls = @($rows | ForEach-Object { $_.$column })
} else {
    $urls = @($inputLines | ForEach-Object {
        if ($_ -match 'https?://\S+') { $Matches[0].TrimEnd(',') }
    })
}

$urls = @($urls | Where-Object { $_ -match '^https?://' } | Select-Object -Unique)
if ($urls.Count -eq 0) {
    if ($InputFile) {
        throw "No HTTP/HTTPS image URLs were found in $InputFile."
    }
    throw "No HTTP/HTTPS image URLs were found in the clipboard. Copy the image_url column, then run this script again."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$successes = 0
$failures = @()

for ($index = 0; $index -lt $urls.Count; $index++) {
    $url = $urls[$index]
    try {
        $uri = [Uri]$url
        $filename = [IO.Path]::GetFileName($uri.AbsolutePath)
        if ([string]::IsNullOrWhiteSpace($filename)) { $filename = "image_{0:D4}.bin" -f ($index + 1) }
        $destination = Join-Path $OutputDirectory $filename

        $downloaded = $false
        for ($attempt = 1; $attempt -le $RetryCount -and -not $downloaded; $attempt++) {
            try {
                Invoke-WebRequest -Uri $uri -OutFile $destination -UseBasicParsing
                $downloaded = $true
            } catch {
                if ($attempt -eq $RetryCount) { throw }
            }
        }

        $successes++
        Write-Host ("[{0}/{1}] Downloaded {2}" -f ($index + 1), $urls.Count, $filename) -ForegroundColor Green
    } catch {
        $failures += [PSCustomObject]@{ Url = $url; Error = $_.Exception.Message }
        Write-Warning ("[{0}/{1}] Failed: {2}" -f ($index + 1), $urls.Count, $url)
    }
}

if ($failures.Count -gt 0) {
    $failures | Export-Csv -NoTypeInformation -Path (Join-Path $OutputDirectory 'failed_downloads.csv')
}

Write-Host "`nFinished: $successes downloaded, $($failures.Count) failed." -ForegroundColor Cyan
if ($failures.Count -gt 0) {
    Write-Host "Failed URLs were saved to $OutputDirectory\failed_downloads.csv" -ForegroundColor Yellow
}
