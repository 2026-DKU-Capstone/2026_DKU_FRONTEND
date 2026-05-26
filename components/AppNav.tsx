'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import GNB from './GNB';
import StepNav from './StepNav';
import { getGroupId, getGroupName, setGroupName } from '@/lib/group';
import { apiFetch } from '@/lib/api';

const STEP_MAP: Record<string, number> = {
  '/receipt':         1,
  '/form-recommend':  2,
  '/doc-review':      3,
  '/compliance':      4,
  '/pdf':             5,
};

const STEP_TITLES: Record<number, string> = {
  1: 'STEP 1 · 증빙 자료 업로드',
  2: 'STEP 2 · 양식 추천',
  3: 'STEP 3 · 초안 확인·수정',
  4: 'STEP 4 · 규정 검토',
  5: 'STEP 5 · 문서 저장',
};

const MENU_MAP: Record<string, string> = {
  '/dashboard':       '대시보드',
  '/expense-board':   '지출결의',
  '/receipt':         '지출결의',
  '/form-recommend':  '지출결의',
  '/doc-review':      '지출결의',
  '/compliance':      '지출결의',
  '/pdf':             '지출결의',
  '/regulation':      '규정관리',
  '/upload':          '규정관리',
  '/forms':           '양식지',
  '/approvals':       '결재',
};

export default function AppNav() {
  const pathname = usePathname();
  const currentStep = STEP_MAP[pathname];
  const activeMenu = MENU_MAP[pathname]
    ?? (pathname.startsWith('/approvals') ? '결재' : '대시보드');
  const isWorkflow = currentStep !== undefined;
  const [workspaceName, setWorkspaceName] = useState<string>('내 워크스페이스');
  const [bizName, setBizName] = useState<string>('지출결의서 작성 플로우');

  useEffect(() => {
    const cached = getGroupName();
    if (cached) {
      setWorkspaceName(cached);
      return;
    }
    const groupId = getGroupId();
    if (!groupId) return;
    apiFetch(`/api/groups/${groupId}`)
      .then(r => r.ok ? r.json() : null)
      .then(g => {
        if (g?.name) {
          setWorkspaceName(g.name);
          setGroupName(g.name);
        }
      })
      .catch(() => { /* 표시명 미설정으로 폴백 */ });
  }, []);

  useEffect(() => {
    if (!isWorkflow) return;
    const stored = localStorage.getItem('currentBusinessName');
    if (stored) setBizName(stored);
  }, [isWorkflow, pathname]);

  return (
    <>
      <GNB activeMenu={activeMenu} workspaceName={workspaceName} />
      {isWorkflow && (
        <>
          <div style={{
            background: 'var(--navy)', color: '#fff',
            padding: '18px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: 'var(--font-ui)',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 4, letterSpacing: '0.5px' }}>
                현재 사업
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{bizName}</div>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              {STEP_TITLES[currentStep]}
            </span>
          </div>
          <StepNav currentStep={currentStep} />
        </>
      )}
    </>
  );
}
