'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { RouteGuard } from '../../../components/route-guard';
import { EnterpriseLayout } from '../../../components/enterprise-layout';
import { createMember, deleteMember, listMembers, updateMemberRole, type EnterpriseMemberRole } from '../../../lib/api/enterprise';
import type { AuthUser } from '../../../lib/api/auth';
import { BalanceApiError } from '../../../lib/api/client';
import { useAuth } from '../../../context/auth-context';
import { canDeleteEnterpriseMember, validatePasswordComplexity } from '../../../lib/role-permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { PageTransition } from '@/components/workspace/page-transition';

export default function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<EnterpriseMemberRole>('staff');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    setLoading(true);
    setError(null);
    try {
      const data = await listMembers();
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!newDisplayName.trim()) { setFormError('Display name is required.'); return; }
    if (!newEmail.trim()) { setFormError('Email is required.'); return; }
    const passwordError = validatePasswordComplexity(newPassword);
    if (passwordError) { setFormError(passwordError); return; }

    setSubmitting(true);
    try {
      await createMember(newEmail.trim(), newPassword, newDisplayName.trim(), newRole);
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewRole('staff');
      setShowAddForm(false);
      await loadMembers();
    } catch (err) {
      if (err instanceof BalanceApiError && err.status === 409) {
        setFormError('A user with this email already exists.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to create member');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteMember(memberId: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from the organization?`)) return;

    try {
      await deleteMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete member');
    }
  }

  async function handleChangeRole(memberId: string, role: EnterpriseMemberRole) {
    setError(null);
    try {
      const res = await updateMemberRole(memberId, role);
      setMembers((items) => items.map((m) => (m.id === memberId ? res.member : m)));
    } catch (err) {
      setError(err instanceof BalanceApiError ? err.error.message : 'Failed to update member role.');
    }
  }

  return (
    <RouteGuard allowedRoles={['admin']}>
      <EnterpriseLayout>
        <PageTransition>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Team members</h1>
                <p className="text-sm text-muted-foreground">Manage who has access to your organization.</p>
              </div>
              <Button onClick={() => setShowAddForm((v) => !v)}>
                <Plus className="size-4" />
                {showAddForm ? 'Cancel' : 'Add member'}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">{error}</Alert>
            )}

            {/* Add member form */}
            {showAddForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add team member</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddMember} className="grid gap-4">
                    <div>
                      <Label htmlFor="newDisplayName">Display name</Label>
                      <Input
                        id="newDisplayName"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        disabled={submitting}
                        placeholder="Staff name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newEmail">Email</Label>
                      <Input
                        id="newEmail"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={submitting}
                        placeholder="staff@balance.local"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newPassword">Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={submitting}
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newRole">Role</Label>
                      <Select value={newRole} onValueChange={(value) => setNewRole(value as EnterpriseMemberRole)} disabled={submitting}>
                        <SelectTrigger id="newRole"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="reviewer">Reviewer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formError && (
                      <Alert variant="destructive">{formError}</Alert>
                    )}
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Adding…' : 'Add member'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Members list */}
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading members…</p>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No team members yet.</p>
                <p className="text-xs text-muted-foreground">Click &quot;Add member&quot; to invite someone.</p>
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const canDelete = canDeleteEnterpriseMember(user, member);
                      const canEditRole = member.id !== user?.id;
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.displayName}</TableCell>
                          <TableCell className="text-muted-foreground">{member.email}</TableCell>
                          <TableCell>
                            {canEditRole ? (
                              <Select
                                value={member.role}
                                onValueChange={(value) => handleChangeRole(member.id, value as EnterpriseMemberRole)}
                              >
                                <SelectTrigger className="h-8 w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="reviewer">Reviewer</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm text-muted-foreground capitalize">{member.role.replace('_', ' ')}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {canDelete ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${member.displayName}`}
                                onClick={() => handleDeleteMember(member.id, member.email)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Protected</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </PageTransition>
      </EnterpriseLayout>
    </RouteGuard>
  );
}
