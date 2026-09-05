import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

export default function AdminCustomers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
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
  const [editCardDatesCustomer, setEditCardDatesCustomer] = useState(null);
  const [newPurchaseDate, setNewPurchaseDate] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
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
    mutationFn: () => Promise.reject(new Error('Customer accounts are not stored on Cloudflare yet')),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['customers'] });
      const previous = qc.getQueryData(['customers']);
      qc.setQueryData(['customers'], (old) => old?.filter(c => c.id !== id) ?? old);
      setDeleteCustomer(null);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['customers'], context.previous);
      toast.error('Delete failed.');
    },
    onSuccess: () => { toast.success('Customer deleted.'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['customers'] }); },
  });

  const toggleCard = (customer, value) => {
    const fn = value ? 'activateMembership' : 'deactivateMembership';
    invokeAdmin(fn, { customer_id: customer.id }).then((data) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(value ? 'Card activated for 30 months. +100 points logged.' : 'Card deactivated.');
      qc.invalidateQueries({ queryKey: ['customers'] });
    });
  };

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

  const handleAdjustWallet = () => {
    const amt = parseFloat(walletAmount);
    if (!amt || amt <= 0 || isNaN(amt)) { toast.error('Enter a valid positive amount'); return; }
    const delta = walletMode === 'deduct' ? -amt : amt;
    const newBalance = (addWalletCustomer.wallet_balance || 0) + delta;
    if (newBalance < 0) { toast.error('Balance cannot go below $0.00'); return; }
    updateMut.mutate({
      id: addWalletCustomer.id,
      data: { wallet_balance: newBalance },
    }, {
      onSuccess: () => {
        const label = walletMode === 'deduct' ? 'deducted from' : 'added to';
        toast.success(`${walletMode === 'deduct' ? '-' : '+'}$${amt.toFixed(2)} ${label} ${addWalletCustomer.full_name}'s wallet`);
        setAddWalletCustomer(null);
        setWalletAmount('');
      }
    });
  };

  const handleEditCardDates = async () => {
    if (!newPurchaseDate) { toast.error('Please enter a purchase date'); return; }
    if (!newExpiryDate) { toast.error('Please enter an expiry date'); return; }
    const data = await invokeAdmin('updateMembershipExpiry', {
      customer_id: editCardDatesCustomer.id,
      activated_at: newPurchaseDate,
      expires_at: newExpiryDate,
    });
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    toast.success(`Card dates updated for ${editCardDatesCustomer.full_name}`);
    setEditCardDatesCustomer(null);
    setNewPurchaseDate('');
    setNewExpiryDate('');
    qc.invalidateQueries({ queryKey: ['customers'] });
  };

  const [drawEntriesMode, setDrawEntriesMode] = useState('add');
  const [pointsMode, setPointsMode] = useState('add');

  const handleEditDrawEntries = () => {
    const entries = parseInt(drawEntriesToAdd);
    if (!entries || entries <= 0) { toast.error('Enter a valid number'); return; }
    const delta = drawEntriesMode === 'deduct' ? -entries : entries;
    const newEntries = (editDrawEntriesCustomer.draw_entries || 0) + delta;
    if (newEntries < 0) { toast.error('Draw entries cannot go below 0'); return; }
    updateMut.mutate({
      id: editDrawEntriesCustomer.id,
      data: { draw_entries: newEntries },
    }, {
      onSuccess: () => {
        toast.success(`${drawEntriesMode === 'deduct' ? '-' : '+'}${entries} draw entries ${drawEntriesMode === 'deduct' ? 'removed from' : 'added to'} ${editDrawEntriesCustomer.full_name}`);
        setEditDrawEntriesCustomer(null);
        setDrawEntriesToAdd('');
      }
    });
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
      <h1 className="font-heading font-bold text-2xl mb-6">Customers</h1>

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

      <Dialog open={!!editCardDatesCustomer} onOpenChange={open => { if (!open) { setEditCardDatesCustomer(null); setNewPurchaseDate(''); setNewExpiryDate(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Card Dates for {editCardDatesCustomer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={newPurchaseDate}
                  onChange={e => setNewPurchaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={newExpiryDate}
                  onChange={e => setNewExpiryDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditCardDatesCustomer(null); setNewPurchaseDate(''); setNewExpiryDate(''); }}>Cancel</Button>
            <Button onClick={handleEditCardDates} disabled={updateMut.isPending}>Save</Button>
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
              Points after approval: {createTxType === 'LOYALTY_CARD' ? 100 : pointsForPurchaseUsd(Number(createTxAmount))}
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
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Draw Entries</TableHead>
                <TableHead>Card Number</TableHead>
                <TableHead>WinWin Card</TableHead>
                <TableHead>Card Expiry</TableHead>
                <TableHead>Ambassador Code</TableHead>
                <TableHead>Ambassador</TableHead>
                <TableHead>Wallet Balance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {c.full_name}
                      <button
                        onClick={() => { setAddPointsCustomer(c); setPointsMode('add'); setPointsToAdd(''); }}
                        className="text-primary hover:text-primary/70 transition-colors"
                        title="Add Points"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setAddPointsCustomer(c); setPointsMode('deduct'); setPointsToAdd(''); }}
                        className="text-destructive hover:text-destructive/70 transition-colors"
                        title="Remove Points"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.mobile}
                      <button
                        onClick={() => { setEditMobileCustomer(c); setNewMobile(c.mobile || ''); }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Edit Mobile"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{c.country}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.points || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{c.draw_entries || 0}</Badge>
                      <button
                        onClick={() => { setEditDrawEntriesCustomer(c); setDrawEntriesMode('add'); setDrawEntriesToAdd(''); }}
                        className="text-primary hover:text-primary/70 transition-colors"
                        title="Add Draw Entries"
                      >
                        <PlusCircle className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setEditDrawEntriesCustomer(c); setDrawEntriesMode('deduct'); setDrawEntriesToAdd(''); }}
                        className="text-destructive hover:text-destructive/70 transition-colors"
                        title="Remove Draw Entries"
                      >
                        <MinusCircle className="w-3 h-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{c.card_number || '-'}</span>
                      <button
                        onClick={() => { setEditCardNumberCustomer(c); setNewCardNumber(c.card_number || ''); }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Edit Card Number"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                    checked={c.has_winwin_card || false}
                    onCheckedChange={v => toggleCard(c, v)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.card_expiry_date ? (
                        <Badge variant={new Date(c.card_expiry_date) < new Date() ? 'destructive' : 'outline'}>
                          {new Date(c.card_expiry_date).toLocaleDateString()}
                        </Badge>
                      ) : '-'}
                      <button
                        onClick={() => { setEditCardDatesCustomer(c); setNewPurchaseDate(c.card_purchase_date || ''); setNewExpiryDate(c.card_expiry_date || ''); }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Edit Card Dates"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{c.ambassador_code || '-'}</span>
                      <button
                        onClick={() => { setEditAmbassadorCustomer(c); setNewAmbassadorCode(c.ambassador_code || ''); }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Edit Ambassador Code"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={c.is_ambassador || false}
                      onCheckedChange={v => toggleAmbassador(c, v)}
                    />
                  </TableCell>
                  <TableCell>
                   {c.is_ambassador ? (
                     <div className="flex items-center gap-1">
                       <span className="font-medium text-accent">${(c.wallet_balance || 0).toFixed(2)}</span>
                       <button
                         onClick={() => { setAddWalletCustomer(c); setWalletMode('add'); setWalletAmount(''); }}
                         className="text-green-600 hover:text-green-800 transition-colors"
                         title="Add USD"
                       >
                         <PlusCircle className="w-4 h-4" />
                       </button>
                       <button
                         onClick={() => { setAddWalletCustomer(c); setWalletMode('deduct'); setWalletAmount(''); }}
                         className="text-destructive hover:text-destructive/70 transition-colors"
                         title="Deduct USD"
                       >
                         <MinusCircle className="w-4 h-4" />
                       </button>
                     </div>
                   ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHistoryCustomer(c)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Points history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      {c.account_source === 'migrated' && c.password_setup_required ? (
                        <button
                          onClick={async () => {
                            const data = await invokeAdmin('adminSendPasswordSetup', {
                              customer_id: c.id,
                              app_origin: window.location.origin,
                            });
                            if (data?.error) {
                              toast.error(data.error);
                              return;
                            }
                            if (data.setup_url) {
                              try { await navigator.clipboard.writeText(data.setup_url); } catch { /* ignore */ }
                              toast.success('Password setup link copied');
                            } else {
                              toast.success('Setup email queued if mail is configured');
                            }
                          }}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Send password setup link"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => { setCreateTxCustomer(c); setCreateTxType('PRODUCT_PURCHASE'); setCreateTxAmount(''); setCreateTxNote(''); }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Create pending transaction"
                      >
                        <ClipboardList className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteCustomer(c)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete Customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                    {search.trim() ? 'No customers match your search.' : 'No customers yet'}

                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
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
          <DialogTitle>Points history — {customer?.full_name}</DialogTitle>
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
                {row.points_amount >= 0 ? '+' : ''}{row.points_amount}
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