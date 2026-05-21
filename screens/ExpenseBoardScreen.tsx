'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';

type EvidenceStatus = 'draft' | 'in_progress' | 'approved' | 'rejected';

interface EvidenceItem {
  evidenceId: number;
  businessName: string;
  status: EvidenceStatus;
  totalAmount: number | null;
  updatedAt: string | null;
}

interface Biz {
  no: string;
  name: string;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  count: string;
  amount: string;
  modified: string;
}

const STATUS_CFG: Record<EvidenceStatus, { label: string; bg: string; color: string }> = {
  draft:       { label: '작성 중',    bg: 'var(--amber-bg)',  color: 'var(--amber)' },
  in_progress: { label: '결재 진행중', bg: 'var(--blue-pale)', color: 'var(--blue)'  },
  approved:    { label: '결재 완료',  bg: 'var(--green-bg)',  color: 'var(--green)' },
  rejected:    { label: '반려됨',     bg: '#FEE8E8',          color: 'var(--red)'   },
};

const FALLBACK_STATUS = { label: '-', bg: 'var(--gray1)', color: 'var(--gray4)' };

function groupByBusinessName(items: EvidenceItem[]): Biz[] {
  const map = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const key = item.businessName || '(사업명 없음)';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  return Array.from(map.entries()).map(([name, list], i) => {
    // 가장 최근 상태로 배지 결정
    const latest = list.sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    )[0];
    const cfg = STATUS_CFG[latest.status] ?? FALLBACK_STATUS;

    const modified = latest.updatedAt
      ? latest.updatedAt.slice(0, 10).replace(/-/g, '.')
      : '-';

    return {
      no: String(i + 1).padStart(3, '0'),
      name,
      badgeLabel: cfg.label,
      badgeBg: cfg.bg,
      badgeColor: cfg.color,
      count: `${list.length}건`,
      amount: '-', // totalAmount 항상 null — 백엔드 추후 지원 예정
      modified,
    };
  });
}

export default function ExpenseBoardScreen() {
  const router = useRouter();
  const [bizList, setBizList] = useState<Biz[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const groupId = getGroupId();
    if (!groupId) { setLoading(false); return; }

    apiFetch(`/api/evidence/list?groupId=${groupId}`)
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then((data: EvidenceItem[]) => setBizList(groupByBusinessName(data)))
      .catch(() => setBizList([]))
      .finally(() => setLoading(false));
  }, []);

  function startBiz() {
    if (!name.trim()) return;
    sessionStorage.setItem('currentBusinessName', name.trim());
    setOpen(false);
    setName('');
    router.push('/receipt');
  }

  function selectBiz(b: Biz) {
    sessionStorage.setItem('filterBusinessName', b.name);
    sessionStorage.setItem('approvalTab', 'group');
    router.push('/approvals');
  }

  const fi: React.CSSProperties = {
    width: '100%', border: '1px solid var(--gray2)', borderRadius: 6,
    color: 'var(--navy)', fontSize: 13, fontFamily: 'inherit',
    padding: '9px 12px', height: 40, background: '#fff', outline: 'none',
  };
  const fl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--gray5)', marginBottom: 5, display: 'block',
  };

  return (
    <div style={{ fontFamily: 'var(--font-ui)', padding: '28px 32px', color: 'var(--navy)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>지출결의</div>
          <div style={{ fontSize: 13, color: 'var(--gray4)' }}>사업별 지출결의를 관리합니다</div>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'var(--navy)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '9px 20px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >+ 사업 추가</button>
      </div>

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid var(--gray2)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr 120px 80px 130px 100px',
          alignItems: 'center', gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--gray1)',
          background: 'var(--gray1)',
          fontSize: 10, fontWeight: 700, color: 'var(--gray4)',
          letterSpacing: '0.3px', textTransform: 'uppercase',
        }}>
          <div>번호</div><div>사업명</div><div>상태</div><div>건수</div><div>총 금액</div><div>최근 수정</div>
        </div>

        {loading ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--gray4)' }}>
            불러오는 중...
          </div>
        ) : bizList.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--gray4)' }}>
            등록된 사업이 없습니다
          </div>
        ) : bizList.map((b, i) => (
          <div
            key={b.name}
            onClick={() => selectBiz(b)}
            style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 120px 80px 130px 100px',
              alignItems: 'center', gap: 12,
              padding: '14px 20px',
              borderBottom: i === bizList.length - 1 ? 'none' : '1px solid var(--gray1)',
              cursor: 'pointer', transition: 'background .12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-pale)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontSize: 11, color: 'var(--gray4)' }}>{b.no}</div>
            <div>
              <strong style={{ fontSize: 13 }}>{b.name}</strong>
            </div>
            <div>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: b.badgeBg, color: b.badgeColor,
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
              }}>{b.badgeLabel}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray5)' }}>{b.count}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray4)' }}>{b.amount}</div>
            <div style={{ fontSize: 11, color: 'var(--gray4)' }}>{b.modified}</div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} width={400}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>새 사업 추가</div>
        <div style={{ fontSize: 12, color: 'var(--gray4)', marginBottom: 18 }}>
          지출결의를 관리할 사업명을 입력해 주세요
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={fl}>사업명 <span style={{ color: 'var(--red)' }}>*</span></label>
          <input
            style={fi}
            placeholder="예: 2024 동아리 행사비 정산"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startBiz()}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setOpen(false)}
            style={{
              flex: 1, background: 'var(--gray2)', color: 'var(--gray5)',
              border: 'none', borderRadius: 6, padding: '9px 20px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >취소</button>
          <button
            onClick={startBiz}
            disabled={!name.trim()}
            style={{
              flex: 1, background: 'var(--navy)', color: '#fff',
              border: 'none', borderRadius: 6, padding: '9px 20px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              opacity: !name.trim() ? 0.5 : 1,
            }}
          >사업 추가</button>
        </div>
      </Modal>
    </div>
  );
}
