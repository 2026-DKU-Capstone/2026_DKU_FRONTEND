'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';

interface Step {
  approverName: string;
  approvalOrder: number;
  roleName: string;
  action: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  comment: string | null;
  actedAt: string | null;
}

interface Approval {
  requestId: number;
  status: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  currentApprovalOrder: number;
  filledFields: Record<string, string>;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
  businessName?: string;
}

type Tab = 'my' | 'group';
type StatusFilter = 'ALL' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';

const STATUS_CFG: Record<Approval['status'], { label: string; bg: string; color: string }> = {
  IN_PROGRESS: { label: '진행중', bg: 'var(--amber-bg)',  color: 'var(--amber)' },
  APPROVED:    { label: '승인',   bg: 'var(--green-bg)',  color: 'var(--green)' },
  REJECTED:    { label: '반려',   bg: 'var(--red-bg)',    color: 'var(--red)'   },
  CANCELED:    { label: '취소',   bg: 'var(--gray2)',     color: 'var(--gray5)' },
};

function formatDate(s: string) {
  return s.slice(0, 10).replace(/-/g, '.');
}

function deriveTitle(a: Approval): string {
  const fields = a.filledFields ?? {};
  return fields['사업명'] || fields['지출명'] || fields['제목'] || `결재 #${a.requestId}`;
}

function deriveAmount(a: Approval): string {
  const fields = a.filledFields ?? {};
  for (const [k, v] of Object.entries(fields)) {
    if (/금액|합계/.test(k)) {
      const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
      if (!isNaN(n)) return `₩${n.toLocaleString()}`;
    }
  }
  return '—';
}

export default function ApprovalListScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'my';
    const t = sessionStorage.getItem('approvalTab');
    if (t === 'group' || t === 'my') { sessionStorage.removeItem('approvalTab'); return t; }
    return 'my';
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bizFilter, setBizFilter] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = sessionStorage.getItem('filterBusinessName');
    if (stored) { sessionStorage.removeItem('filterBusinessName'); return stored; }
    return null;
  });

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function load() {
    setLoading(true); setError('');
    try {
      const groupId = getGroupId();
      const url = tab === 'my'
        ? '/api/approvals/my'
        : groupId ? `/api/approvals/group/${groupId}` : null;
      if (!url) { setError('그룹이 선택되지 않았습니다.'); setLoading(false); return; }
      const res = await apiFetch(url);
      if (res.ok) setApprovals(await res.json());
      else setError('목록을 불러오지 못했습니다.');
    } catch { setError('서버에 연결할 수 없습니다.'); }
    finally { setLoading(false); }
  }

  const filtered = approvals
    .filter(a => statusFilter === 'ALL' || a.status === statusFilter)
    .filter(a => !bizFilter || a.businessName === bizFilter);

  const counts = approvals.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ fontFamily: 'var(--font-ui)', padding: '28px 32px', color: 'var(--navy)' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>결재 목록</div>
        <div style={{ fontSize: 13, color: 'var(--gray4)' }}>
          제출한 결재와 그룹 내 결재 요청을 관리합니다.
        </div>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--gray2)', marginBottom: 16,
      }}>
        {(['my', 'group'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 18px', background: 'none',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: tab === t ? '2px solid var(--navy)' : '2px solid transparent',
              fontSize: 13, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--navy)' : 'var(--gray4)',
              marginBottom: -1, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{t === 'my' ? '내 결재' : '그룹 결재'}</button>
        ))}
      </div>

      {/* 상태 필터 + 카운터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { key: 'ALL',         label: '전체',    count: approvals.length },
          { key: 'IN_PROGRESS', label: '진행중',  count: counts['IN_PROGRESS'] ?? 0 },
          { key: 'APPROVED',    label: '승인',    count: counts['APPROVED'] ?? 0 },
          { key: 'REJECTED',    label: '반려',    count: counts['REJECTED'] ?? 0 },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key as StatusFilter)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 100,
              fontSize: 12, fontWeight: 600,
              background: statusFilter === f.key ? 'var(--navy)' : 'var(--gray1)',
              color: statusFilter === f.key ? '#fff' : 'var(--gray5)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{f.label} <span style={{ fontFamily: 'var(--font-mono)' }}>{f.count}</span></button>
        ))}
      </div>

      {bizFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--gray5)' }}>사업 필터:</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 100,
            background: 'var(--navy)', color: '#fff',
            fontSize: 11, fontWeight: 600,
          }}>
            {bizFilter}
            <button
              onClick={() => setBizFilter(null)}
              style={{
                background: 'none', border: 'none', color: '#fff',
                cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >×</button>
          </span>
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 12, color: 'var(--red)',
          background: 'var(--red-bg)', border: '1px solid #F5C6C6',
          borderRadius: 6, padding: '8px 12px', marginBottom: 16,
        }}>{error}</div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--gray4)' }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--gray4)',
          background: '#fff', border: '1px solid var(--gray2)', borderRadius: 12,
        }}>표시할 결재가 없습니다.</div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid var(--gray2)', overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 100px 120px 130px 100px',
            gap: 12, padding: '12px 20px',
            background: 'var(--gray1)',
            fontSize: 10, fontWeight: 700, color: 'var(--gray4)',
            letterSpacing: '0.3px', textTransform: 'uppercase',
          }}>
            <div>번호</div>
            <div>내용</div>
            <div>상태</div>
            <div>현재 단계</div>
            <div>금액</div>
            <div>제출일</div>
          </div>
          {filtered.map(a => {
            const cfg = STATUS_CFG[a.status];
            const currentStep = a.steps.find(s => s.approvalOrder === a.currentApprovalOrder);
            return (
              <div
                key={a.requestId}
                onClick={() => router.push(`/approvals/${a.requestId}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 100px 120px 130px 100px',
                  gap: 12, padding: '14px 20px',
                  borderTop: '1px solid var(--gray1)',
                  cursor: 'pointer', alignItems: 'center',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-pale)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 11, color: 'var(--gray4)', fontFamily: 'var(--font-mono)' }}>#{a.requestId}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{deriveTitle(a)}</div>
                <div>
                  <span style={{
                    display: 'inline-flex', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 100,
                    background: cfg.bg, color: cfg.color,
                  }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray5)' }}>
                  {a.status === 'IN_PROGRESS' && currentStep
                    ? `${currentStep.roleName} 결재 대기`
                    : '—'}
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--navy)' }}>
                  {deriveAmount(a)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray4)' }}>{formatDate(a.createdAt)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
