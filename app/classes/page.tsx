import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createClass } from '@/app/actions/classes';

export const runtime = 'edge';

export default async function ClassesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/classes');
  }

  const teacherId = Number(session.user.id);

  const classes = await prisma.class.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Teaching Classes</h1>
            <p className="text-muted-foreground mt-2">
              Manage your classes and prepare for AI-assisted teaching workflows.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Classes</CardTitle>
              <CardDescription>Classes associated with your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You don&apos;t have any classes yet. Use the form on the right to create one.
                </p>
              ) : (
                <ul className="space-y-3">
                  {classes.map(cls => (
                    <li key={cls.id} className="flex flex-col rounded-md border border-border p-3">
                      <Link
                        href={`/classes/${cls.id}`}
                        className="font-medium hover:underline underline-offset-2"
                      >
                        {cls.name}
                      </Link>
                      <span className="text-xs text-muted-foreground mt-1">
                        Grade level: {cls.gradeLevel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create New Class</CardTitle>
              <CardDescription>
                Define a class as the basic unit for students, lessons, and uploads.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createClass} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Class name</Label>
                  <Input id="name" name="name" placeholder="e.g. 二年级1班" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gradeLevel">Grade level</Label>
                  <Input id="gradeLevel" name="gradeLevel" placeholder="e.g. 小学二年级" required />
                </div>
                <Button type="submit" className="w-full">
                  Create Class
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
