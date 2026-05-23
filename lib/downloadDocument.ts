import { apiFetch } from './api';

function parseFilenameFromContentDisposition(cd: string): string | null {
  const mStar = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (mStar) {
    try { return decodeURIComponent(mStar[1]); } catch { return mStar[1]; }
  }
  const mPlain = cd.match(/filename="?([^";]+)"?/i);
  return mPlain ? mPlain[1] : null;
}

export async function downloadDocument({
  evidenceId,
  formId,
  filledFields,
  userInputFields,
  imageFields,
  formName = '문서',
}: {
  evidenceId: number | string;
  formId: number | string;
  filledFields: Record<string, string>;
  userInputFields?: Record<string, string>;
  imageFields?: Record<string, string>;
  formName?: string;
}): Promise<string | null> {
  const res = await apiFetch(`/api/evidence/${evidenceId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      forms: [{ formId: Number(formId), filledFields, userInputFields, imageFields }],
    }),
  });

  if (res.ok) {
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') ?? '';
    const cdName = parseFilenameFromContentDisposition(cd);
    const cdExt = cdName?.match(/\.[a-z0-9]+$/i)?.[0] ?? '';
    const contentType = res.headers.get('content-type') ?? '';
    const ext = contentType.includes('zip') ? '.zip' : (cdExt || '.docx');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formName}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    return null;
  } else {
    const body = await res.json().catch(() => null);
    return body?.error ?? '파일 생성에 실패했습니다.';
  }
}
