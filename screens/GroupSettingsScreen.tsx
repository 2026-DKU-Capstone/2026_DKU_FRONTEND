'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getGroupId, setGroupName } from '@/lib/group';
import { getUserInfo } from '@/lib/auth';

interface Role {
  roleId: number;
  roleName: string;
  approvalOrder: number;
}

interface Member {
  userId: number;
  name: string;
  email: string;
  roleName: string;
  approvalOrder: number;
}

interface PayerInfo {
  name: string;
  affiliation: string;
  studentId: string;
  phone: string;
}

interface Group {
  groupId: number;
  name: string;
  inviteCode: string;
  ownerId: number;
  ownerName: string;
  roles: Role[];
  members: Member[];
  payerInfo: PayerInfo | null;
}

export default function GroupSettingsScreen() {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 역할 추가/편집
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleOrder, setNewRoleOrder] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editRoleName, setEditRoleName] = useState('');

  // 지출인 정보 폼
  const [payer, setPayer] = useState<PayerInfo>({ name: '', affiliation: '', studentId: '', phone: '' });
  const [payerSaving, setPayerSaving] = useState(false);
  const [payerSaved, setPayerSaved] = useState(false);

  useEffect(() => {
    const groupId = getGroupId();
    if (!groupId) { router.replace('/group-select'); return; }
    loadGroup(groupId);
  }, [router]);

  async function loadGroup(groupId: number) {
    setLoading(true); setError('');
    try {
      const res = await apiFetch(`/api/groups/${groupId}`);
      if (res.ok) {
        const data: Group = await res.json();
        setGroup(data);
        setGroupName(data.name);
        if (data.payerInfo) setPayer(data.payerInfo);
      } else {
        setError('그룹 정보를 불러오지 못했습니다.');
      }
    } catch { setError('서버에 연결할 수 없습니다.'); }
    finally { setLoading(false); }
  }

  if (loading) return <div style={{ padding: 32, fontFamily: 'var(--font-ui)' }}>불러오는 중...</div>;
  if (error || !group) return <div style={{ padding: 32, fontFamily: 'var(--font-ui)', color: 'var(--red)' }}>{error}</div>;

  const me = getUserInfo();
  const isOwner = me ? group.ownerId === me.userId : false;

  async function kickMember(userId: number, name: string) {
    if (!group) return;
    if (!confirm(`${name}님을 그룹에서 추방하시겠습니까? 진행 중인 결재의 PENDING 단계는 자동 취소됩니다.`)) return;
    try {
      const res = await apiFetch(`/api/groups/${group.groupId}/members/${userId}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) loadGroup(group.groupId);
      else { const b = await res.json().catch(() => null); alert(b?.error ?? '추방 실패'); }
    } catch { alert('서버 연결 실패'); }
  }

  async function changeMemberRole(userId: number, roleId: number) {
    if (!group) return;
    try {
      const res = await apiFetch(`/api/groups/${group.groupId}/members/role`, {
        method: 'PUT',
        body: JSON.stringify({ userId, roleId }),
      });
      if (res.ok) loadGroup(group.groupId);
      else { const b = await res.json().catch(() => null); alert(b?.error ?? '역할 변경 실패'); }
    } catch { alert('서버 연결 실패'); }
  }

  async function addRole() {
    if (!group) return;
    if (!newRoleName.trim() || !newRoleOrder) return;
    try {
      const res = await apiFetch(`/api/groups/${group.groupId}/roles`, {
        method: 'POST',
        body: JSON.stringify({
          roleName: newRoleName.trim(),
          approvalOrder: Number(newRoleOrder),
        }),
      });
      if (res.ok) {
        setNewRoleName(''); setNewRoleOrder('');
        loadGroup(group.groupId);
      } else { const b = await res.json().catch(() => null); alert(b?.error ?? '역할 추가 실패'); }
    } catch { alert('서버 연결 실패'); }
  }

  async function saveRoleEdit(role: Role) {
    if (!group) return;
    if (!editRoleName.trim()) return;
    try {
      const res = await apiFetch(`/api/groups/${group.groupId}/roles/${role.roleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          roleName: editRoleName.trim(),
          approvalOrder: role.approvalOrder,
        }),
      });
      if (res.ok) {
        setEditingRoleId(null); setEditRoleName('');
        loadGroup(group.groupId);
      } else { const b = await res.json().catch(() => null); alert(b?.error ?? '수정 실패'); }
    } catch { alert('서버 연결 실패'); }
  }

  async function deleteRole(role: Role) {
    if (!group) return;
    if (!confirm(`"${role.roleName}" 역할을 삭제하시겠습니까? (해당 역할에 멤버가 있으면 삭제할 수 없습니다)`)) return;
    try {
      const res = await apiFetch(`/api/groups/${group.groupId}/roles/${role.roleId}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) loadGroup(group.groupId);
      else { const b = await res.json().catch(() => null); alert(b?.error ?? '삭제 실패'); }
    } catch { alert('서버 연결 실패'); }
  }

  async function savePayerInfo() {
    if (!group) return;
    setPayerSaving(true); setPayerSaved(false);
    try {
      const res = await apiFetch(`/api/groups/${group.groupId}/payer-info`, {
        method: 'PUT',
        body: JSON.stringify(payer),
      });
      if (res.ok) { setPayerSaved(true); loadGroup(group.groupId); }
      else { const b = await res.json().catch(() => null); alert(b?.error ?? '저장 실패'); }
    } catch { alert('서버 연결 실패'); }
    finally { setPayerSaving(false); }
  }

  const fi: React.CSSProperties = {
    width: '100%', border: '1px solid var(--gray2)', borderRadius: 6,
    color: 'var(--navy)', fontSize: 13, fontFamily: 'inherit',
    padding: '9px 12px', height: 38, background: '#fff', outline: 'none',
  };
  const fl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--gray5)', marginBottom: 5, display: 'block',
  };
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid var(--gray2)', padding: '20px 22px',
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 12,
  };

  return (
    <div style={{ fontFamily: 'var(--font-ui)', padding: 32, color: 'var(--navy)' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>그룹 설정</div>
        <div style={{ fontSize: 13, color: 'var(--gray4)' }}>
          {group.name} · 멤버 {group.members.length}명 · 대표 {group.ownerName}
          {!isOwner && <span style={{ marginLeft: 8, color: 'var(--amber)' }}>· 일부 항목은 대표자만 변경 가능합니다</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* 좌: 멤버 + 역할 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 초대코드 */}
          <div style={{ ...card, background: 'var(--blue-pale)', borderColor: '#C8D6E8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', marginBottom: 4, letterSpacing: '0.5px' }}>INVITE CODE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--navy)', letterSpacing: '2px' }}>
              {group.inviteCode}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray5)', marginTop: 6 }}>
              초대코드를 공유해 멤버를 추가할 수 있습니다.
            </div>
          </div>

          {/* 멤버 */}
          <div style={card}>
            <div style={sectionLabel}>멤버 ({group.members.length})</div>
            {group.members.map(m => (
              <div key={m.userId} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 12px',
                background: 'var(--gray1)', borderRadius: 8, marginBottom: 8,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--navy)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{m.name.slice(0, 1)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray4)' }}>{m.email}</div>
                </div>
                {isOwner ? (
                  <select
                    value={group.roles.find(r => r.roleName === m.roleName)?.roleId ?? ''}
                    onChange={e => changeMemberRole(m.userId, Number(e.target.value))}
                    style={{
                      border: '1px solid var(--gray2)', borderRadius: 6,
                      padding: '5px 8px', fontSize: 12, fontFamily: 'inherit',
                      color: 'var(--navy)', background: '#fff', outline: 'none',
                    }}
                  >
                    {group.roles.map(r => (
                      <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: 'var(--blue-pale)', color: 'var(--blue)' }}>
                    {m.roleName}
                  </span>
                )}
                {isOwner && me?.userId !== m.userId && (
                  <button
                    onClick={() => kickMember(m.userId, m.name)}
                    style={{
                      background: 'var(--gray2)', color: 'var(--gray5)',
                      border: 'none', borderRadius: 6,
                      padding: '5px 10px', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >추방</button>
                )}
              </div>
            ))}
          </div>

          {/* 역할 */}
          <div style={card}>
            <div style={sectionLabel}>결재 역할</div>
            {group.roles.sort((a, b) => a.approvalOrder - b.approvalOrder).map(r => (
              <div key={r.roleId} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px',
                background: 'var(--gray1)', borderRadius: 8, marginBottom: 6,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#fff', border: '1px solid var(--gray2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--gray5)', flexShrink: 0,
                }}>{r.approvalOrder}</div>
                {editingRoleId === r.roleId ? (
                  <>
                    <input
                      autoFocus
                      value={editRoleName}
                      onChange={e => setEditRoleName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRoleEdit(r); }}
                      style={{ ...fi, height: 30, padding: '4px 8px' }}
                    />
                    <button
                      onClick={() => saveRoleEdit(r)}
                      style={{
                        background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6,
                        padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >저장</button>
                    <button
                      onClick={() => { setEditingRoleId(null); setEditRoleName(''); }}
                      style={{
                        background: 'var(--gray2)', color: 'var(--gray5)', border: 'none', borderRadius: 6,
                        padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >취소</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{r.roleName}</span>
                    {isOwner && (
                      <>
                        <button
                          onClick={() => { setEditingRoleId(r.roleId); setEditRoleName(r.roleName); }}
                          style={{
                            background: 'var(--gray2)', color: 'var(--gray5)', border: 'none', borderRadius: 6,
                            padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >수정</button>
                        <button
                          onClick={() => deleteRole(r)}
                          style={{
                            background: 'var(--red-bg)', color: 'var(--red)', border: 'none', borderRadius: 6,
                            padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >삭제</button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}

            {isOwner && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gray2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray5)', marginBottom: 6 }}>역할 추가</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    placeholder="역할명"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    style={{ ...fi, flex: 1, height: 32, padding: '4px 10px' }}
                  />
                  <input
                    placeholder="순서"
                    type="number"
                    value={newRoleOrder}
                    onChange={e => setNewRoleOrder(e.target.value)}
                    style={{ ...fi, width: 80, height: 32, padding: '4px 10px' }}
                  />
                  <button
                    onClick={addRole}
                    style={{
                      background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6,
                      padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >추가</button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--gray4)', marginTop: 4 }}>
                  순서가 낮을수록 하위 역할(부원: 0, 차장: 1, 부장: 2 ...)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우: 지출인 정보 */}
        <div style={card}>
          <div style={sectionLabel}>지출인 정보</div>
          <div style={{ fontSize: 12, color: 'var(--gray5)', marginBottom: 14, lineHeight: 1.6 }}>
            여기에 등록한 정보는 양식지의 "지출인" 필드에 자동 입력됩니다.
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={fl}>이름</label>
            <input style={fi} value={payer.name} onChange={e => setPayer({ ...payer, name: e.target.value })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fl}>소속</label>
            <input style={fi} placeholder="예: 컴퓨터공학과" value={payer.affiliation} onChange={e => setPayer({ ...payer, affiliation: e.target.value })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fl}>학번/사번</label>
            <input style={{ ...fi, fontFamily: 'var(--font-mono)' }} placeholder="32210000" value={payer.studentId} onChange={e => setPayer({ ...payer, studentId: e.target.value })} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={fl}>전화번호</label>
            <input style={{ ...fi, fontFamily: 'var(--font-mono)' }} placeholder="010-1234-5678" value={payer.phone} onChange={e => setPayer({ ...payer, phone: e.target.value })} />
          </div>

          <button
            onClick={savePayerInfo}
            disabled={payerSaving}
            style={{
              width: '100%', background: payerSaved ? 'var(--green)' : 'var(--navy)',
              color: '#fff', border: 'none', borderRadius: 6, padding: '11px 20px',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              cursor: payerSaving ? 'not-allowed' : 'pointer',
              opacity: payerSaving ? 0.7 : 1,
            }}
          >{payerSaved ? '✓ 저장됨' : payerSaving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}
