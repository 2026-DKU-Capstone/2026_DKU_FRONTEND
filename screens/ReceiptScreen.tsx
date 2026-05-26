'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';
import { Modal } from '@/components/ui';

interface AvailableForm {
  formId: number;
  formName: string;
  description: string;
  paymentType: string;
  fields: string[];
}

interface UploadedFile {
  file: File;
  ext: string;
  size: number;
}

const EXT_COLORS: Record<string, { bg: string; color: string }> = {
  PDF:  { bg: 'var(--red-bg)',    color: 'var(--red)'  },
  JPG:  { bg: 'var(--green-bg)',  color: 'var(--green)' },
  JPEG: { bg: 'var(--green-bg)',  color: 'var(--green)' },
  PNG:  { bg: 'var(--blue-pale)', color: 'var(--blue)' },
};

function getExt(name: string) {
  return (name.split('.').pop() ?? '').toUpperCase();
}

export default function ReceiptScreen() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    localStorage.setItem('lastStep', '1');
  }, []);

  const handlePicked = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    // 여러 장을 한 번에 올리면 큐에 추가해 한 건씩 순서대로 작성한다 (#3 연속 작성)
    const added = Array.from(picked).map(f => ({ file: f, ext: getExt(f.name), size: f.size }));
    setFiles(prev => [...prev, ...added]);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  async function goNext() {
    if (files.length === 0) {
      setError('증빙 파일을 1개 이상 업로드해 주세요.');
      return;
    }
    setError(''); setAnalyzing(true);
    try {
      const groupId = getGroupId();
      const businessName = localStorage.getItem('currentBusinessName');
      const itemName = localStorage.getItem('currentItemName');
      // 업로드한 파일을 한 건씩 OCR 분석해 큐로 만든다. (#3 연속 작성)
      const queue: { evidenceId: number; availableForms: AvailableForm[]; fileName: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        setAnalyzeProgress({ current: i + 1, total: files.length });
        const fd = new FormData();
        fd.append('file', files[i].file);
        if (groupId) fd.append('groupId', String(groupId));
        if (businessName) fd.append('businessName', businessName);
        if (itemName) fd.append('itemName', itemName);
        const res = await apiFetch('/api/evidence/analyze', { method: 'POST', body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(`${files[i].file.name} 분석 실패: ${body?.error ?? 'OCR 분석에 실패했습니다.'}`);
          setAnalyzing(false);
          return;
        }
        const data: { evidenceId: number; paymentType: string; extractedText: string; availableForms: AvailableForm[] } = await res.json();
        queue.push({ evidenceId: data.evidenceId, availableForms: data.availableForms, fileName: files[i].file.name });
      }
      // 새 분석 배치 시작 — 이전 문서의 학생증/입력값 캐시 제거.
      // (수령인은 문서마다 새 학생증을 받아야 하므로, 직전 문서의 studentCardPhoto·userInputFields가
      //  남아 수령인 필드가 '이미 채워짐'으로 보여 업로드가 생략되는 것을 막는다.)
      ['studentCardPhoto', 'userInputFields', 'missingFields', 'filledFields', 'formId', 'formName', 'selectedFormIds']
        .forEach(k => localStorage.removeItem(k));
      // 큐 저장 + 첫 번째 증빙으로 시작
      localStorage.setItem('evidenceQueue', JSON.stringify(queue));
      localStorage.setItem('queueIndex', '0');
      localStorage.setItem('evidenceId', String(queue[0].evidenceId));
      localStorage.setItem('availableForms', JSON.stringify(queue[0].availableForms));
      // 증빙별 스냅샷 저장 (큐 전체)
      queue.forEach(q => {
        const existing = JSON.parse(localStorage.getItem(`eid_${q.evidenceId}`) ?? '{}');
        existing.lastStep = '2';
        existing.availableForms = JSON.stringify(q.availableForms);
        localStorage.setItem(`eid_${q.evidenceId}`, JSON.stringify(existing));
      });
      router.push('/form-recommend');
    } catch {
      setError('서버에 연결할 수 없습니다.');
      setAnalyzing(false);
    }
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div style={{ fontFamily: 'var(--font-ui)', padding: '48px 32px 80px', color: 'var(--navy)' }}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
        style={{ display: 'none' }}
        onChange={e => { handlePicked(e.target.files); e.target.value = ''; }}
      />

      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <div style={{ fontSize: 11, color: 'var(--gray4)', marginBottom: 6, letterSpacing: '0.4px' }}>STEP 1 / 5</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--navy)', letterSpacing: '-0.6px', marginBottom: 8 }}>
          증빙자료를 업로드해 주세요
        </div>
        <div style={{ fontSize: 14, color: 'var(--gray5)', lineHeight: 1.65, marginBottom: 36, maxWidth: 580 }}>
          영수증·세금계산서·카드전표 등을 한 번에 올려주세요. AI가 OCR로 인식한 정보를 토대로 다음 단계에서 결의서 초안을 자동 생성합니다.
        </div>

        {/* 드롭존 */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            handlePicked(e.dataTransfer.files);
          }}
          style={{
            border: dragging ? '1.5px dashed var(--navy)' : '1.5px dashed var(--gray3)',
            borderRadius: 24,
            padding: '64px 32px 56px',
            textAlign: 'center',
            background: dragging
              ? 'linear-gradient(180deg,#FFFFFF 0%,#EEF2F8 100%)'
              : 'linear-gradient(180deg,#FFFFFF 0%,#F7F9FC 100%)',
            cursor: 'pointer',
            transition: '.2s',
            position: 'relative', overflow: 'hidden',
            boxShadow: dragging ? '0 14px 36px rgba(28,43,74,.08)' : 'none',
            transform: dragging ? 'translateY(-1px)' : 'none',
          }}
        >
          {files.length === 0 ? (
          <>
          {/* Paper illustration */}
          <div style={{ width: 200, height: 140, margin: '0 auto 28px', position: 'relative' }}>
            <div style={{
              position: 'absolute', background: '#fff',
              borderRadius: 10, border: '1px solid #DDE3EE',
              boxShadow: '0 6px 18px rgba(28,43,74,.06)',
              width: 130, height: 160,
              left: '50%', top: '50%',
              transform: 'translate(-50%,-50%) rotate(-10deg)',
            }} />
            <div style={{
              position: 'absolute', background: '#FAFBFD',
              borderRadius: 10, border: '1px solid #DDE3EE',
              boxShadow: '0 6px 18px rgba(28,43,74,.06)',
              width: 130, height: 160,
              left: '50%', top: '50%',
              transform: 'translate(-50%,-50%) rotate(8deg)',
            }} />
            <div style={{
              position: 'absolute', background: '#fff',
              borderRadius: 10, border: '1px solid #C8D2E0',
              boxShadow: '0 12px 28px rgba(28,43,74,.10)',
              width: 130, height: 160,
              left: '50%', top: '50%',
              transform: 'translate(-50%,-50%) rotate(-1deg)',
            }}>
              <div style={{ position: 'absolute', left: 18, right: 18, top: 22, height: 6, background: '#E2E7EF', borderRadius: 2, width: '60%' }} />
              <div style={{ position: 'absolute', left: 18, right: 18, top: 38, height: 6, background: '#E2E7EF', borderRadius: 2, width: '80%' }} />
              <div style={{ position: 'absolute', left: 18, right: 18, top: 54, height: 6, background: '#C8D2E0', borderRadius: 2, width: '50%' }} />
              <div style={{ position: 'absolute', left: 18, right: 18, top: 78, height: 8, background: 'var(--navy)', borderRadius: 2, width: '78%' }} />
              <div style={{ position: 'absolute', left: 18, right: 18, top: 92, height: 7, background: 'var(--navy)', borderRadius: 2, width: '50%' }} />
              <div style={{ position: 'absolute', left: 18, right: 18, top: 120, height: 6, background: '#B8C2D0', borderRadius: 2, width: '88%' }} />
              <div style={{
                position: 'absolute', right: -6, top: 6,
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--navy)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 300,
                boxShadow: '0 6px 14px rgba(28,43,74,.25)',
              }}>+</div>
            </div>
          </div>

          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 8, letterSpacing: '-0.3px' }}>
            파일을 끌어다 놓거나 클릭해서 업로드하세요
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray5)', marginBottom: 24 }}>
            여러 장을 한 번에 올리면 한 건씩 순서대로 이어서 작성합니다
          </div>
          <div style={{ display: 'inline-flex', gap: 10 }}>
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{
                background: 'var(--navy)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px 20px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >컴퓨터에서 선택</button>
            <button
              onClick={e => { e.stopPropagation(); }}
              style={{
                background: '#fff', color: 'var(--navy)',
                border: '1.5px solid var(--gray2)', borderRadius: 10,
                padding: '11px 20px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >사진 촬영</button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 18, marginTop: 24, fontSize: 11, color: 'var(--gray4)',
          }}>
            {['PDF', 'JPG / JPEG', 'PNG', 'XLS / XLSX'].map(t => (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px', background: '#fff',
                border: '1px solid var(--gray2)', borderRadius: 100,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                {t}
              </span>
            ))}
            <span>최대 20MB / 파일</span>
          </div>
          </>
          ) : (
          /* 파일 선택 후: 드롭존이 파일 목록 카드로 전환 (#1) */
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}
          >
            {files.map((f, i) => {
              const c = EXT_COLORS[f.ext] ?? { bg: 'var(--gray1)', color: 'var(--gray4)' };
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: '#fff', border: '1px solid var(--gray2)',
                  borderRadius: 12, padding: '14px 18px',
                }}>
                  <div style={{
                    width: 38, height: 46, borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800,
                    background: c.bg, color: c.color, flexShrink: 0,
                  }}>{f.ext}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--navy)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{f.file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray4)', fontFamily: 'var(--font-mono)' }}>
                      {(f.size / 1024).toFixed(0)}KB · 업로드 완료
                    </div>
                    <div style={{
                      height: 4, background: 'var(--gray2)', borderRadius: 100,
                      marginTop: 6, overflow: 'hidden',
                    }}>
                      <div style={{ height: '100%', background: 'var(--green)', borderRadius: 100, width: '100%' }} />
                    </div>
                  </div>
                  <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 18 }}>✓</span>
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(i); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--gray3)',
                      cursor: 'pointer', fontSize: 15, fontFamily: 'inherit',
                    }}
                  >✕</button>
                </div>
              );
            })}
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{
                alignSelf: 'center', marginTop: 4,
                background: '#fff', color: 'var(--navy)',
                border: '1.5px solid var(--gray2)', borderRadius: 10,
                padding: '9px 18px', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >+ 파일 추가</button>
          </div>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: 14,
            fontSize: 12, color: 'var(--red)',
            background: 'var(--red-bg)', border: '1px solid #F5C6C6',
            borderRadius: 6, padding: '8px 12px',
          }}>{error}</div>
        )}

        {/* 가이드 카드 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 32,
        }}>
          {[
            { t: 'AI 자동 인식', d: '금액·날짜·거래처를 자동으로 추출하여 결의서에 채워 넣어요.',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M9 11h.01M15 11h.01M9 15c1.5 1 4.5 1 6 0" strokeLinecap="round"/></svg>,
            },
            { t: '규정 사전 점검', d: '한도 초과·증빙 누락 항목을 업로드 시점에 미리 감지합니다.',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.5"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" strokeLinejoin="round"/></svg>,
            },
            { t: '초안 자동 생성', d: '선택한 양식에 맞춰 다음 단계에서 결의서 초안을 자동 작성해드려요.',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.5"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round"/></svg>,
            },
          ].map(t => (
            <div key={t.t} style={{
              background: '#fff', border: '1px solid var(--gray2)',
              borderRadius: 12, padding: 18,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'var(--blue-pale)', color: 'var(--navy)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 10,
              }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{t.t}</div>
              <div style={{ fontSize: 11, color: 'var(--gray4)', lineHeight: 1.6 }}>{t.d}</div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--gray2)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--gray5)' }}>
            업로드된 파일 <b style={{ color: 'var(--navy)' }}>{files.length}</b>개 · {(totalSize / 1024).toFixed(0)}KB
          </div>
          <button
            onClick={goNext}
            disabled={analyzing}
            style={{
              background: 'var(--navy)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '14px 28px',
              fontSize: 14, fontWeight: 700,
              cursor: analyzing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: analyzing ? 0.7 : 1,
            }}
          >다음 → 양식 추천</button>
        </div>
      </div>

      {/* OCR 분석 모달 */}
      <Modal open={analyzing} closeOnBackdrop={false}>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{
            width: 42, height: 42, border: '3px solid var(--gray2)',
            borderTopColor: 'var(--navy)', borderRadius: '50%',
            margin: '0 auto 18px',
            animation: 'rspin .7s linear infinite',
          }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
            증빙 자료 분석 중...
            {analyzeProgress.total > 1 && (
              <span style={{ color: 'var(--gray4)', fontWeight: 600, fontSize: 13 }}>
                {' '}({analyzeProgress.current}/{analyzeProgress.total})
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray4)', lineHeight: 1.7 }}>
            AI가 OCR로 문서를 인식하고<br />금액·날짜·거래처를 추출하는 중입니다
          </div>
        </div>
      </Modal>

      <style>{`@keyframes rspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
