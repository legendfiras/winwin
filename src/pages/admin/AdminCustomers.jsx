import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, MinusCircle, Pencil, Trash2, Search, History, ClipboardList, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { invokeAdmin } from '@/lib/customerAuth';
import { pointsForPurchaseUsd } from '@/lib/pointsTiers';
import { useEarnSettings } from '@/lib/useSettings';

export default function AdminCustomers() {
  const qc = useQueryClient();
  const earn = useEarnSettings();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [addPointsCustomer, setAddPointsCustomer] = useState(null);
  const [pointsToAdd, setPointsToAdd] = useState('');
  const [editMobileCustomer, setEditMobileCustomer] = useState(null);
  const [newMobile, setNewMobile] = useState('');
  const [editAmbassadorCustomer, setEditAmbassadorCustomer] = useState(null);
  const [newAmbassadorCode, setNewAmbassadorCode] = useState('');
  const [deleteCustomer, setDeleteCustomer] = useState(null);
  const [editCardNumberCustomer, setEditCardNumberCustomer] = useState(null);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [addWalletCustomer, setAddWalletCustomer] = useState(null);
  const [walletMode, setWalletMode] = useState('add');
  const [walletAmount, setWalletAmount] = useState('');
  const [editDrawEntriesCustomer, setEditDrawEntriesCustomer] = useState(null);
  const [drawEntriesToAdd, setDrawEntriesToAdd] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [createTxCustomer, setCreateTxCustomer] = useState(null);
  const [createTxType, setCreateTxType] = useState('PRODUCT_PURCHASE');
  const [createTxAmount, setCreateTxAmount] = useState('');
  const [createTxNote, setCreateTxNote] = useState('');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await invokeAdmin('listCustomers');
      return res?.customers || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.full_name?.toLowerCase().includes(q) ||
      c.mobile?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.legacy_user_id?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((customer) => customer.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find((customer) => customer.id === selectedId) || null;

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => invokeAdmin('adminUpdateCustomer', { customer_id: id, ...data }),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ['customers'] });
      const previous = qc.getQueryData(['customers']);
      qc.setQueryData(['customers'], (old) =>
        old?.map(c => c.id === id ? { ...c, ...data } : c) ?? old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['customers'], context.previous);
      toast.error('Update failed.');
    },
    onSuccess: () => { toast.success('Updated!'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['customers'] }); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const data = await invokeAdmin('deleteCustomer', { customer_id: id });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['customers'] });
      const previous = qc.getQueryData(['customers']);
      qc.setQueryData(['customers'], (old) => old?.filter(c => c.id !== id) ?? old);
      setDeleteCustomer(null);
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['customers'], context.previous);
      toast.error(err?.message || 'Delete failed.');
    },
    onSuccess: () => { toast.success('Customer deleted.'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['customers'] }); },
  });

  const handleEditMobile = () => {
    if (!newMobile.trim()) { toast.error('Enter a valid mobile number'); return; }
    updateMut.mutate({ id: editMobileCustomer.id, data: { mobile: newMobile.trim() } }, {
      onSuccess: () => {
        toast.success(`Mobile updated for ${editMobileCustomer.full_name}`);
        setEditMobileCustomer(null);
        setNewMobile('');
      }
    });
  };

  const handleEditAmbassador = () => {
    updateMut.mutate({ id: editAmbassadorCustomer.id, data: { ambassador_code: newAmbassadorCode.trim() || null } }, {
      onSuccess: () => {
        toast.success(`Ambassador code updated for ${editAmbassadorCustomer.full_name}`);
        setEditAmbassadorCustomer(null);
        setNewAmbassadorCode('');
      }
    });
  };

  const toggleAmbassador = (customer, value) => {
    updateMut.mutate({ id: customer.id, data: { is_ambassador: value } });
  };

  const handleEditCardNumber = () => {
    updateMut.mutate({ id: editCardNumberCustomer.id, data: { card_number: newCardNumber.trim() || null } }, {
      onSuccess: () => {
        toast.success(`Card number updated for ${editCardNumberCustomer.full_name}`);
        setEditCardNumberCustomer(null);
        setNewCardNumber('');
      }
    });
  };

  const handleAdjustWallet = async () => {
    const amt = parseFloat(walletAmount);
    if (!amt || amt <= 0 || isNaN(amt)) { toast.error('Enter a valid positive amount'); return; }
    const data = await invokeAdmin('adjustWallet', {
      customer_id: addWalletCustomer.id,
      amount: amt,
      mode: walletMode === 'deduct' ? 'deduct' : 'add',
    });
    if (data?.error) { toast.error(data.error); return; }
    const label = walletMode === 'deduct' ? 'deducted from' : 'added to';
    toast.success(`${walletMode === 'deduct' ? '-' : '+'}$${amt.toFixed(2)} ${label} ${addWalletCustomer.full_name}'s wallet`);
    setAddWalletCustomer(null);
    setWalletAmount('');
    qc.invalidateQueries({ queryKey: ['customers'] });
  };

  const [drawEntriesMode, setDrawEntriesMode] = useState('add');
  const [pointsMode, setPointsMode] = useState('add');

  const handleEditDrawEntries = async () => {
    const entries = parseInt(drawEntriesToAdd);
    if (!entries || entries <= 0) { toast.error('Enter a valid number'); return; }
    const data = await invokeAdmin('adjustDrawEntries', {
      customer_id: editDrawEntriesCustomer.id,
      amount: entries,
      mode: drawEntriesMode === 'deduct' ? 'deduct' : 'add',
    });
    if (data?.error) { toast.error(data.error); return; }
    toast.success(`${drawEntriesMode === 'deduct' ? '-' : '+'}${entries} draw entries ${drawEntriesMode === 'deduct' ? 'removed from' : 'added to'} ${editDrawEntriesCustomer.full_name}`);
    setEditDrawEntriesCustomer(null);
    setDrawEntriesToAdd('');
    qc.invalidateQueries({ queryKey: ['customers'] });
  };

  const handleAddPoints = async () => {
    const pts = parseInt(pointsToAdd);
    if (!pts || pts <= 0) { toast.error('Enter a valid number of points'); return; }
    if (!pointsReason.trim()) { toast.error('Enter a reason'); return; }
    const data = await invokeAdmin('adjustPoints', {
      customer_id: addPointsCustomer.id,
      amount: pts,
      mode: pointsMode === 'deduct' ? 'remove' : 'add',
      reason: pointsReason.trim(),
    });
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    toast.success(`${pointsMode === 'deduct' ? '-' : '+'}${pts} points ${pointsMode === 'deduct' ? 'removed from' : 'added to'} ${addPointsCustomer.full_name}`);
    setAddPointsCustomer(null);
    setPointsToAdd('');
    setPointsReason('');
    qc.invalidateQueries({ queryKey: ['customers'] });
  };

  return (
    <AdminLayout>
      <h1 className="mb-1 font-heading text-2xl font-bold">Users</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">Pick a customer and control their points, wallet, draws, phone, and ambassador status. Card dates stay on Loyalty.</p>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Dialog open={!!editCardNumberCustomer} onOpenChange={open => { if (!open) { setEditCardNumberCustomer(null); setNewCardNumber(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Card Number for {editCardNumberCustomer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Current: <strong>{editCardNumberCustomer?.card_number || 'None'}</strong></p>
            <div className="space-y-1">
              <Label>Card Number</Label>
              <Input
                placeholder="e.g. WW-2024-001"
                value={newCardNumber}
                onChange={e => setNewCardNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditCardNumber()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditCardNumberCustomer(null); setNewCardNumber(''); }}>Cancel</Button>
            <Button onClick={handleEditCardNumber} disabled={updateMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addWalletCustomer} onOpenChange={open => { if (!open) { setAddWalletCustomer(null); setWalletAmount(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {walletMode === 'deduct' ? 'Deduct from' : 'Add to'} {addWalletCustomer?.full_name}'s Wallet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Current balance: <strong>${(addWalletCustomer?.wallet_balance || 0).toFixed(2)}</strong></p>
            <div className="space-y-1">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 50.00"
                value={walletAmount}
                onChange={e => setWalletAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdjustWallet()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              New balance: <strong>${((addWalletCustomer?.wallet_balance || 0) + (walletMode === 'deduct' ? -(parseFloat(walletAmount) || 0) : (parseFloat(walletAmount) || 0))).toFixed(2)}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddWalletCustomer(null); setWalletAmount(''); }}>Cancel</Button>
            <Button
              onClick={handleAdjustWallet}
              disabled={updateMut.isPending}
              className={walletMode === 'deduct' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {walletMode === 'deduct' ? 'Deduct' : 'Add'} USD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCustomer} onOpenChange={open => { if (!open) setDeleteCustomer(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{deleteCustomer?.full_name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCustomer(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate(deleteCustomer.id)} disabled={deleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAmbassadorCustomer} onOpenChange={open => { if (!open) { setEditAmbassadorCustomer(null); setNewAmbassadorCode(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Ambassador Code for {editAmbassadorCustomer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Current: <strong>{editAmbassadorCustomer?.ambassador_code || 'None'}</strong></p>
            <div className="space-y-1">
              <Label>Ambassador Code</Label>
              <Input
                placeholder="Enter ambassador code"
                value={newAmbassadorCode}
                onChange={e => setNewAmbassadorCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditAmbassador()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditAmbassadorCustomer(null); setNewAmbassadorCode(''); }}>Cancel</Button>
            <Button onClick={handleEditAmbassador} disabled={updateMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMobileCustomer} onOpenChange={open => { if (!open) { setEditMobileCustomer(null); setNewMobile(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Mobile for {editMobileCustomer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Current: <strong>{editMobileCustomer?.mobile}</strong></p>
            <div className="space-y-1">
              <Label>New Mobile Number</Label>
              <Input
                placeholder="e.g. 0096170123456"
                value={newMobile}
                onChange={e => setNewMobile(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditMobile()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditMobileCustomer(null); setNewMobile(''); }}>Cancel</Button>
            <Button onClick={handleEditMobile} disabled={updateMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDrawEntriesCustomer} onOpenChange={open => { if (!open) { setEditDrawEntriesCustomer(null); setDrawEntriesToAdd(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{drawEntriesMode === 'deduct' ? 'Remove' : 'Add'} Draw Entries — {editDrawEntriesCustomer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Current entries: <strong>{editDrawEntriesCustomer?.draw_entries || 0}</strong></p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={drawEntriesMode === 'add' ? 'default' : 'outline'}
                onClick={() => setDrawEntriesMode('add')}
                className="flex-1"
              >
                <PlusCircle className="w-4 h-4 mr-1" /> Add
              </Button>
              <Button
                size="sm"
                variant={drawEntriesMode === 'deduct' ? 'destructive' : 'outline'}
                onClick={() => setDrawEntriesMode('deduct')}
                className="flex-1"
              >
                <MinusCircle className="w-4 h-4 mr-1" /> Remove
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Number of Entries</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 5"
                value={drawEntriesToAdd}
                onChange={e => setDrawEntriesToAdd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditDrawEntries()}
              />
            </div>
            {drawEntriesToAdd && parseInt(drawEntriesToAdd) > 0 && (
              <p className="text-xs text-muted-foreground">
                New total: <strong>{Math.max(0, (editDrawEntriesCustomer?.draw_entries || 0) + (drawEntriesMode === 'deduct' ? -parseInt(drawEntriesToAdd) : parseInt(drawEntriesToAdd)))}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDrawEntriesCustomer(null); setDrawEntriesToAdd(''); }}>Cancel</Button>
            <Button
              onClick={handleEditDrawEntries}
              disabled={updateMut.isPending}
              className={drawEntriesMode === 'deduct' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {drawEntriesMode === 'deduct' ? 'Remove Entries' : 'Add Entries'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addPointsCustomer} onOpenChange={open => { if (!open) { setAddPointsCustomer(null); setPointsToAdd(''); setPointsReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pointsMode === 'deduct' ? 'Remove' : 'Add'} Points — {addPointsCustomer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Current points: <strong>{addPointsCustomer?.points || 0}</strong></p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={pointsMode === 'add' ? 'default' : 'outline'}
                onClick={() => setPointsMode('add')}
                className="flex-1"
              >
                <PlusCircle className="w-4 h-4 mr-1" /> Add
              </Button>
              <Button
                size="sm"
                variant={pointsMode === 'deduct' ? 'destructive' : 'outline'}
                onClick={() => setPointsMode('deduct')}
                className="flex-1"
              >
                <MinusCircle className="w-4 h-4 mr-1" /> Remove
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Number of Points</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={pointsToAdd}
                onChange={e => setPointsToAdd(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Reason (required)</Label>
              <Input
                placeholder="Why are you changing points?"
                value={pointsReason}
                onChange={e => setPointsReason(e.target.value)}
              />
            </div>
            {pointsToAdd && parseInt(pointsToAdd) > 0 && (
              <p className="text-xs text-muted-foreground">
                New total: <strong>{Math.max(0, (addPointsCustomer?.points || 0) + (pointsMode === 'deduct' ? -parseInt(pointsToAdd) : parseInt(pointsToAdd)))}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddPointsCustomer(null); setPointsToAdd(''); setPointsReason(''); }}>Cancel</Button>
            <Button
              onClick={handleAddPoints}
              className={pointsMode === 'deduct' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {pointsMode === 'deduct' ? 'Remove Points' : 'Add Points'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PointsHistoryDialog customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />

      <Dialog open={!!createTxCustomer} onOpenChange={open => { if (!open) setCreateTxCustomer(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create pending transaction — {createTxCustomer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={createTxType === 'PRODUCT_PURCHASE' ? 'default' : 'outline'} onClick={() => setCreateTxType('PRODUCT_PURCHASE')}>Product</Button>
              <Button size="sm" variant={createTxType === 'LOYALTY_CARD' ? 'default' : 'outline'} onClick={() => { setCreateTxType('LOYALTY_CARD'); setCreateTxAmount('10'); }}>Loyalty card</Button>
            </div>
            <div>
              <Label>Amount USD</Label>
              <Input type="number" step="0.01" value={createTxAmount} onChange={e => setCreateTxAmount(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={createTxNote} onChange={e => setCreateTxNote(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">
              Points after approval: {createTxType === 'LOYALTY_CARD' ? 100 : pointsForPurchaseUsd(Number(createTxAmount), earn)}
            </p>
            <Button className="w-full" onClick={async () => {
              const data = await invokeAdmin('adminCreateTransaction', {
                customer_id: createTxCustomer.id,
                type: createTxType,
                amount_usd: Number(createTxAmount),
                product_summary: createTxNote,
              });
              if (data?.error) return toast.error(data.error);
              toast.success('Pending transaction created.');
              setCreateTxCustomer(null);
              setCreateTxAmount('');
              setCreateTxNote('');
            }}>Create pending</Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="max-h-[72vh] overflow-y-auto">
            {filtered.map((c) => {
              const active = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left ${active ? 'bg-[#9F1D35] text-white' : 'hover:bg-[#F5EDE1]'}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-heading font-semibold">{c.full_name}</span>
                    <span className={`block truncate text-xs ${active ? 'text-white/80' : 'text-muted-foreground'}`}>{c.mobile || c.email || 'No phone'}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-white/15' : 'bg-[#F5EDE1] text-[#7A1528]'}`}>
                    {c.points || 0} pts
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && !isLoading && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search.trim() ? 'No customers match your search.' : 'No customers yet'}
              </p>
            )}
          </div>
        </Card>

        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-1 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-xl font-bold">{selected.full_name}</h2>
                    <p className="text-sm text-muted-foreground">{selected.email || 'No email'} · {selected.country || 'No country'}</p>
                  </div>
                  {selected.card_active ? <Badge>Card active</Badge> : <Badge variant="outline">No card</Badge>}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Points</p>
                  <p className="font-heading text-3xl font-bold">{selected.points || 0}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setAddPointsCustomer(selected); setPointsMode('add'); setPointsToAdd(''); }}>
                      <PlusCircle className="mr-1 h-4 w-4" /> Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAddPointsCustomer(selected); setPointsMode('deduct'); setPointsToAdd(''); }}>
                      <MinusCircle className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Draw entries</p>
                  <p className="font-heading text-3xl font-bold">{selected.draw_entries || 0}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setEditDrawEntriesCustomer(selected); setDrawEntriesMode('add'); setDrawEntriesToAdd(''); }}>
                      <PlusCircle className="mr-1 h-4 w-4" /> Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditDrawEntriesCustomer(selected); setDrawEntriesMode('deduct'); setDrawEntriesToAdd(''); }}>
                      <MinusCircle className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
                  <p className="font-heading text-lg font-semibold">{selected.mobile || '—'}</p>
                  <Button size="sm" variant="outline" onClick={() => { setEditMobileCustomer(selected); setNewMobile(selected.mobile || ''); }}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit phone
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WinWin card</p>
                  <p className="text-sm">
                    {selected.card_number || 'No card number'}
                    {selected.card_expiry_date ? ` · expires ${new Date(selected.card_expiry_date).toLocaleDateString()}` : ''}
                    {selected.card_expired ? ' · expired' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditCardNumberCustomer(selected); setNewCardNumber(selected.card_number || ''); }}>
                      <Pencil className="mr-1 h-4 w-4" /> Card number
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/admin/loyalty">Dates in Loyalty</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ambassador</p>
                    <Switch checked={selected.is_ambassador || false} onCheckedChange={(v) => toggleAmbassador(selected, v)} />
                  </div>
                  <p className="text-sm">{selected.ambassador_code || 'No ambassador code'}</p>
                  <Button size="sm" variant="outline" onClick={() => { setEditAmbassadorCustomer(selected); setNewAmbassadorCode(selected.ambassador_code || ''); }}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit code
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wallet</p>
                  {selected.is_ambassador ? (
                    <>
                      <p className="font-heading text-3xl font-bold">${(selected.wallet_balance || 0).toFixed(2)}</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { setAddWalletCustomer(selected); setWalletMode('add'); setWalletAmount(''); }}>
                          <PlusCircle className="mr-1 h-4 w-4" /> Add
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setAddWalletCustomer(selected); setWalletMode('deduct'); setWalletAmount(''); }}>
                          <MinusCircle className="mr-1 h-4 w-4" /> Deduct
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Turn ambassador on to use a wallet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setHistoryCustomer(selected)}>
                <History className="mr-1 h-4 w-4" /> History
              </Button>
              <Button variant="outline" onClick={() => { setCreateTxCustomer(selected); setCreateTxType('PRODUCT_PURCHASE'); setCreateTxAmount(''); setCreateTxNote(''); }}>
                <ClipboardList className="mr-1 h-4 w-4" /> New order
              </Button>
              {selected.account_source === 'migrated' && selected.password_setup_required ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const data = await invokeAdmin('adminSendPasswordSetup', {
                      customer_id: selected.id,
                      app_origin: window.location.origin,
                    });
                    if (data?.error) {
                      toast.error(data.error);
                      return;
                    }
                    if (data.emailed) {
                      toast.success('Password reset email sent');
                      return;
                    }
                    if (data.setup_url) {
                      try { await navigator.clipboard.writeText(data.setup_url); } catch { /* ignore */ }
                      toast.success('Email could not be sent. The setup link was copied instead.');
                    } else {
                      toast.error('Could not send the password reset email');
                    }
                  }}
                >
                  <KeyRound className="mr-1 h-4 w-4" /> Password link
                </Button>
              ) : null}
              <Button variant="destructive" onClick={() => setDeleteCustomer(selected)}>
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">
              {isLoading ? 'Loading customers...' : 'Select a customer to edit their account.'}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

function ledgerAmount(row) {
  const amount = Number(row.points_amount) || 0;
  const sign = amount > 0 ? '+' : '';
  if (row.type === 'WALLET_ADJUST') return `${sign}$${(amount / 100).toFixed(2)}`;
  if (row.type === 'DRAW_ADJUST') return `${sign}${amount} entries`;
  return `${sign}${amount} pts`;
}

function PointsHistoryDialog({ customer, onClose }) {
  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ['adminLedger', customer?.id],
    queryFn: async () => {
      const res = await invokeAdmin('getLedger', { customer_id: customer.id });
      return res?.ledger || [];
    },
    enabled: Boolean(customer?.id),
  });

  return (
    <Dialog open={Boolean(customer)} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account history — {customer?.full_name}</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        <div className="space-y-2">
          {ledger.map(row => (
            <div key={row.id} className="flex justify-between gap-3 border-b py-2 text-sm">
              <div>
                <p className="font-medium">{String(row.type || '').replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">{row.reason}</p>
                <p className="text-xs text-muted-foreground">{row.created_date ? new Date(row.created_date).toLocaleString() : ''}</p>
              </div>
              <span className={row.points_amount >= 0 ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                {ledgerAmount(row)}
              </span>
            </div>
          ))}
          {!isLoading && ledger.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No ledger entries yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}