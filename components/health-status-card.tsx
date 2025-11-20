import { Card, CardContent } from '@/components/ui/card';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, 'available' | 'degraded' | 'unavailable'>;
}

async function fetchHealth(): Promise<HealthResponse> {
  try {
    const origin =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : 'http://localhost:3000');
    const url = `${origin}/api/health`;
    const res = await fetch(url, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error('Health request failed');
    }

    const json = (await res.json()) as { data?: HealthResponse };
    if (json?.data) {
      return json.data;
    }
  } catch (error) {
    console.error('Failed to fetch health status:', error);
  }

  return {
    status: 'unhealthy',
    services: {},
  };
}

const STATUS_STYLE: Record<HealthResponse['status'], string> = {
  healthy: 'text-green-600',
  degraded: 'text-yellow-600',
  unhealthy: 'text-red-600',
};

const SERVICE_STYLE: Record<'available' | 'degraded' | 'unavailable', string> = {
  available: 'text-green-600',
  degraded: 'text-yellow-600',
  unavailable: 'text-red-600',
};

export async function HealthStatusCard() {
  const health = await fetchHealth();
  const statusText =
    health.status === 'healthy'
      ? '系统健康，欢迎使用！'
      : health.status === 'degraded'
        ? '部分服务有限，请留意。'
        : '系统暂不可用，请稍后重试。';

  return (
    <Card className="inline-block text-left">
      <CardContent className="p-4">
        <div className="text-sm font-semibold">系统健康状态</div>
        <div className={`mt-1 text-2xl font-bold ${STATUS_STYLE[health.status] || ''}`}>
          {health.status === 'healthy'
            ? '👍 正常'
            : health.status === 'degraded'
              ? '⚠️ 受限'
              : '❌ 异常'}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{statusText}</p>
        {health.services && (
          <div className="mt-2 space-y-1 text-xs">
            {Object.entries(health.services).map(([service, status]) => (
              <div key={service} className="flex justify-between">
                <span className="capitalize text-muted-foreground">{service}</span>
                <span className={SERVICE_STYLE[status] || ''}>{status}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
