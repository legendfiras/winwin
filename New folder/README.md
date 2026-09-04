# Download the image URLs

1. Copy the complete `image_url` column from Base44, including all rows.
2. Open PowerShell in this folder.
3. Run:

```powershell
.\download_images.ps1
```

Images are saved in `downloaded_images`. Failed URLs are written to
`downloaded_images\failed_downloads.csv` so they can be retried.

Alternatively, save one URL per line as `image_urls.txt` and run:

```powershell
.\download_images.ps1 -InputFile .\image_urls.txt
```