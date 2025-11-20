/**
 * LessonStudentWorks
 * 将二维码、归档进度与作品缩略图集中展示在课程详情页
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AutoMatchedSection } from '@/components/archive/auto-matched-section';
import { PendingConfirmationSection } from '@/components/archive/pending-confirmation-section';
import { PendingManualSection } from '@/components/archive/pending-manual-section';

const QR_BASE_URL = process.env.NEXT_PUBLIC_QR_BASE_URL;

type TriageStatus =
  | 'pending'
  | 'processing'
  | 'auto_matched'
  | 'pending_confirmation'
  | 'pending_manual'
  | 'confirmed'
  | 'failed';

interface StudentSummary {
  id: number;
  name: string;
  nickname: string | null;
}

interface LessonStudentWorksProps {
  lessonId: number;
  title: string;
  className?: string | null;
  gradeLevel?: string | null;
  uploadToken: string;
  students: StudentSummary[];
}

interface UploadWork {
  id: number;
  filePath: string;
  url?: string;
  previewUrl?: string;
  originalFilename: string;
  uploadedAt: number;
  fileSize: number;
  contentType?: string | null;
  triageStatus: TriageStatus;
  student: StudentSummary | null;
  suggestedStudent: StudentSummary | null;
  recognizedName: string | null;
  ocrConfidence: number | null;
  workType: string | null;
  workDescription: string | null;
}

interface WorksStats {
  total: number;
  confirmed: number;
  autoMatched: number;
  pendingConfirmation: number;
  pendingManual: number;
  pending: number;
  processing: number;
  failed: number;
  toArchive: number;
  inProgress: number;
}

interface StudentWorksResponse {
  success: boolean;
  data: Array<Omit<UploadWork, 'triageStatus'> & { triageStatus: string }>;
  stats?: Partial<WorksStats>;
}

const createEmptyStats = (): WorksStats => ({
  total: 0,
  confirmed: 0,
  autoMatched: 0,
  pendingConfirmation: 0,
  pendingManual: 0,
  pending: 0,
  processing: 0,
  failed: 0,
  toArchive: 0,
  inProgress: 0,
});

const deriveStats = (works: UploadWork[]): WorksStats => {
  const stats = createEmptyStats();

  for (const work of works) {
    stats.total += 1;
    switch (work.triageStatus) {
      case 'auto_matched':
        stats.autoMatched += 1;
        break;
      case 'pending_confirmation':
        stats.pendingConfirmation += 1;
        break;
      case 'pending_manual':
        stats.pendingManual += 1;
        break;
      case 'confirmed':
        stats.confirmed += 1;
        break;
      case 'pending':
        stats.pending += 1;
        break;
      case 'processing':
        stats.processing += 1;
        break;
      case 'failed':
        stats.failed += 1;
        break;
      default:
        break;
    }
  }

  stats.toArchive = stats.autoMatched + stats.pendingConfirmation + stats.pendingManual;
  stats.inProgress = stats.pending + stats.processing;
  return stats;
};

export function LessonStudentWorks({
  lessonId,
  title,
  className,
  gradeLevel,
  uploadToken,
  students,
}: LessonStudentWorksProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [works, setWorks] = useState<UploadWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [statsFromServer, setStatsFromServer] = useState<Partial<WorksStats> | null>(null);

  useEffect(() => {
    const path = `/lessons/${lessonId}/upload`;
    const origin =
      typeof window !== 'undefined' ? QR_BASE_URL || window.location.origin : QR_BASE_URL || '';
    const uploadUrl = `${origin}${path}?token=${encodeURIComponent(uploadToken)}`;

    QRCode.toDataURL(uploadUrl, { margin: 1, width: 240 })
      .then(setQrDataUrl)
      .catch((err: unknown) => {
        console.error('生成二维码失败:', err);
      });
  }, [lessonId, uploadToken]);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/student-works?lessonId=${lessonId}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to load works: ${res.status}`);
      }
      const response = (await res.json()) as StudentWorksResponse;
      if (!response?.success) return;

      const normalized: UploadWork[] = (response.data || []).map(work => ({
        ...work,
        triageStatus: (work.triageStatus as TriageStatus) || 'pending',
        previewUrl: work.url || work.previewUrl || '',
      }));

      setWorks(normalized);
      setStatsFromServer(response.stats || null);
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error('加载学生作品失败:', err);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    loadWorks();

    let count = 0;
    const maxPolls = 12;
    const timer = setInterval(() => {
      count += 1;
      loadWorks();
      if (count >= maxPolls) {
        clearInterval(timer);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [loadWorks]);

  const headerText =
    className || gradeLevel
      ? `${title} - ${className || ''}${gradeLevel ? `（${gradeLevel}）` : ''}`
      : title;

  const computedStats = useMemo<WorksStats>(() => {
    const derived = deriveStats(works);
    if (!statsFromServer) {
      return derived;
    }

    const merged: WorksStats = {
      ...derived,
      ...statsFromServer,
    } as WorksStats;

    merged.total = statsFromServer.total ?? derived.total;
    merged.confirmed = statsFromServer.confirmed ?? derived.confirmed;
    merged.autoMatched = statsFromServer.autoMatched ?? derived.autoMatched;
    merged.pendingConfirmation = statsFromServer.pendingConfirmation ?? derived.pendingConfirmation;
    merged.pendingManual = statsFromServer.pendingManual ?? derived.pendingManual;
    merged.pending = statsFromServer.pending ?? derived.pending;
    merged.processing = statsFromServer.processing ?? derived.processing;
    merged.failed = statsFromServer.failed ?? derived.failed;
    merged.toArchive =
      statsFromServer.toArchive ??
      merged.autoMatched + merged.pendingConfirmation + merged.pendingManual;
    merged.inProgress = statsFromServer.inProgress ?? merged.pending + merged.processing;
    return merged;
  }, [statsFromServer, works]);

  const grouped = useMemo(() => {
    return {
      autoMatched: works.filter(work => work.triageStatus === 'auto_matched'),
      pendingConfirmation: works.filter(work => work.triageStatus === 'pending_confirmation'),
      pendingManual: works.filter(work => work.triageStatus === 'pending_manual'),
    };
  }, [works]);

  const confirmAutoMatched = useCallback(async () => {
    const uploadIds = grouped.autoMatched.map(u => u.id);
    if (uploadIds.length === 0) return;
    try {
      const response = await fetch('/api/uploads/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'confirm_auto_matched',
          uploadIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm uploads');
      }

      const result = (await response.json()) as { success?: number; confirmed?: number };
      const confirmedCount = result.confirmed ?? result.success ?? uploadIds.length;
      alert(`成功归档 ${confirmedCount} 个作品`);
      await loadWorks();
    } catch (error) {
      console.error('Failed to confirm all:', error);
      alert('批量确认失败，请重试');
    }
  }, [grouped.autoMatched, loadWorks]);

  const confirmUpload = useCallback(
    async (uploadId: number, studentId: number) => {
      try {
        const response = await fetch(`/api/uploads/${uploadId}/triage`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'confirmed',
            studentId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to confirm upload');
        }

        await loadWorks();
      } catch (error) {
        console.error('Failed to confirm suggestion:', error);
        alert('确认失败，请重试');
      }
    },
    [loadWorks]
  );

  const assignUpload = useCallback(
    async (uploadId: number, studentId: number) => {
      try {
        const response = await fetch(`/api/uploads/${uploadId}/triage`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'confirmed',
            studentId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to assign upload');
        }

        await loadWorks();
      } catch (error) {
        console.error('Failed to manual assign:', error);
        alert('归档失败，请重试');
      }
    },
    [loadWorks]
  );

  const pendingCount =
    grouped.autoMatched.length + grouped.pendingConfirmation.length + grouped.pendingManual.length;
  const allArchived =
    pendingCount === 0 &&
    computedStats.total > 0 &&
    computedStats.failed === 0 &&
    computedStats.inProgress === 0;

  const deleteUpload = useCallback(
    async (uploadId: number) => {
      try {
        const res = await fetch(`/api/uploads/${uploadId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || '删除失败');
        }
        await loadWorks();
      } catch (error) {
        console.error('删除作品失败:', error);
        alert(error instanceof Error ? error.message : '删除失败，请稍后重试');
      }
    },
    [loadWorks]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>学生作品上传二维码</CardTitle>
            <CardDescription>
              保持二维码可见即可让教师手机扫码上传，需要时点击右侧按钮展开。
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setQrExpanded(prev => !prev)}>
            {qrExpanded ? '收起二维码' : '展开二维码'}
          </Button>
        </CardHeader>
        {qrExpanded && (
          <CardContent>
            <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col items-center gap-2">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="学生作品上传二维码"
                    className="h-48 w-48 rounded-md border bg-white p-2 shadow"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-md border bg-muted">
                    <span className="text-xs text-muted-foreground">正在生成二维码…</span>
                  </div>
                )}
                <div className="text-center text-xs text-muted-foreground">
                  当前课程：{headerText}
                </div>
              </div>
              <div className="mt-4 flex-1 text-xs text-muted-foreground md:mt-0 md:pl-6">
                <p>使用说明：</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>在电脑上打开本页面，保持二维码清晰显示。</li>
                  <li>用手机扫码进入上传页面（仅需教师手机）。</li>
                  <li>批量选择作品照片并点击“开始上传”。</li>
                  <li>上传完成后，查看下方的归档进度和缩略图。</li>
                </ol>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>学生作品归档</CardTitle>
            <CardDescription>
              共 {computedStats.total} 个作品{loading ? '（加载中…）' : ''}
              {lastUpdatedAt && !loading ? ` · 最近更新 ${lastUpdatedAt.toLocaleTimeString()}` : ''}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadWorks()}
              disabled={loading}
            >
              刷新数据
            </Button>
            <Button type="button" size="sm" asChild>
              <Link href={`/lessons/${lessonId}/archive`}>打开完整归档视图</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-2xl font-bold">{computedStats.total}</div>
              <div className="text-sm text-muted-foreground">总作品数</div>
            </div>
            <div className="rounded-lg border bg-green-50 p-4">
              <div className="text-2xl font-bold text-green-700">{computedStats.confirmed}</div>
              <div className="text-sm text-green-800">已归档</div>
            </div>
            <div className="rounded-lg border bg-yellow-50 p-4">
              <div className="text-2xl font-bold text-yellow-700">{computedStats.toArchive}</div>
              <div className="text-sm text-yellow-800">待归档</div>
            </div>
            <div className="rounded-lg border bg-blue-50 p-4">
              <div className="text-2xl font-bold text-blue-700">{computedStats.inProgress}</div>
              <div className="text-sm text-blue-800">识别处理中</div>
            </div>
          </div>

          {computedStats.inProgress > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              正在处理 {computedStats.inProgress} 张照片，OCR 识别完成后会自动刷新列表。
            </div>
          )}

          {computedStats.failed > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              有 {computedStats.failed} 张照片处理失败，请稍后重试或手动归档。
            </div>
          )}

          {allArchived && (
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              ✅ 所有作品已归档，无需额外操作。
            </div>
          )}

          <div className="space-y-8">
            <AutoMatchedSection
              uploads={grouped.autoMatched}
              onConfirmAll={confirmAutoMatched}
              onDelete={deleteUpload}
            />

            <PendingConfirmationSection
              uploads={grouped.pendingConfirmation}
              students={students}
              onConfirm={confirmUpload}
              onDelete={deleteUpload}
            />

            <PendingManualSection
              uploads={grouped.pendingManual}
              students={students}
              onAssign={assignUpload}
              onDelete={deleteUpload}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
