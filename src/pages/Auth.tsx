import { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Sparkles, MessageSquare, Bot, Globe, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { lovable } from '@/integrations/lovable';

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');

  useEffect(() => {
    const oauthSuccess = sessionStorage.getItem('oauth_success');
    if (oauthSuccess) {
      sessionStorage.removeItem('oauth_success');
      toast.success('تم تسجيل الدخول بنجاح', {
        description: 'مرحباً بك في جوابي',
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await signIn(loginEmail, loginPassword);

      if (error) {
        toast.error('فشل تسجيل الدخول', {
          description: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        });
      } else {
        toast.success('تم تسجيل الدخول بنجاح', {
          description: 'مرحباً بك في جوابي',
        });
      }
    } catch (err: any) {
      toast.error('فشل تسجيل الدخول', {
        description: err?.message || 'حدث خطأ غير متوقع',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await signUp(signupEmail, signupPassword, signupName);

      if (error) {
        toast.error('فشل إنشاء الحساب', {
          description: error.message,
        });
      } else {
        toast.success('تم إنشاء الحساب بنجاح', {
          description: 'يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب',
        });
      }
    } catch (err: any) {
      toast.error('فشل إنشاء الحساب', {
        description: err?.message || 'حدث خطأ غير متوقع',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setOauthLoading(provider);
    try {
      sessionStorage.setItem('oauth_pending', provider);
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + '/auth',
      });
      if (result.error) {
        toast.error('فشل تسجيل الدخول', { description: result.error.message });
        sessionStorage.removeItem('oauth_pending');
        setOauthLoading(null);
        return;
      }
      if (result.redirected) {
        sessionStorage.setItem('oauth_success', 'true');
        return;
      }
      // If we got here without redirect, tokens were received
      sessionStorage.removeItem('oauth_pending');
      toast.success('تم تسجيل الدخول بنجاح', {
        description: 'مرحباً بك في جوابي',
      });
    } catch (err: any) {
      toast.error('فشل تسجيل الدخول', { description: err?.message || 'حدث خطأ غير متوقع' });
      sessionStorage.removeItem('oauth_pending');
      setOauthLoading(null);
    }
  };

  return (
    <div dir="rtl" className="grid min-h-screen lg:grid-cols-2">
      {/* Brand side */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-primary-foreground lg:flex"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div
          aria-hidden
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl"
        />

        <Link to="/" className="relative z-10 inline-flex items-center gap-2 text-lg font-semibold">
          <ArrowLeft className="h-4 w-4" />
          العودة للرئيسية
        </Link>

        <div className="relative z-10 max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            منصة جوابي
          </div>
          <h2 className="text-4xl font-bold leading-tight">
            بوت ذكي يخدم عملاءك<br />على مدار الساعة
          </h2>
          <p className="mt-4 text-base opacity-90">
            انضم لمئات الأعمال التي تستخدم جوابي لأتمتة خدمة العملاء وزيادة المبيعات.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            {[
              { icon: Bot, text: "بوت يتحدث العربية وجميع اللهجات" },
              { icon: MessageSquare, text: "ربط مع واتساب، تيليجرام، فيسبوك وانستجرام" },
              { icon: Globe, text: "قاعدة معرفة قابلة للتدريب من أي مصدر" },
              { icon: CheckCircle2, text: "إعداد فوري بدون أي خبرة تقنية" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="opacity-95">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs opacity-80">
          © {new Date().getFullYear()} جوابي — جميع الحقوق محفوظة
        </div>
      </div>

      {/* Form side */}
      <div className="relative flex items-center justify-center bg-background p-6 sm:p-10">
        <Link
          to="/"
          className="absolute top-6 right-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          الرئيسية
        </Link>

        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-right">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md lg:hidden">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">مرحباً بك 👋</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              سجّل دخولك أو أنشئ حساباً جديداً وابدأ تجربتك المجانية.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {/* Social auth buttons */}
          <div className="space-y-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-medium border-border hover:bg-[#f8f9ff] hover:border-[#4285F4]/30 transition-colors"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth('google')}
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
              ) : (
                <svg className="ml-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span className="mr-1">تسجيل الدخول بـ Google</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-medium border-border hover:bg-[#f5f5f7] hover:border-[#000]/20 transition-colors"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth('apple')}
            >
              {oauthLoading === 'apple' ? (
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
              ) : (
                <svg className="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              <span className="mr-1">تسجيل الدخول بـ Apple</span>
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">أو</span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="signup">إنشاء حساب</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">البريد الإلكتروني</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="example@email.com"
                    required
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">كلمة المرور</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    dir="ltr"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : null}
                  تسجيل الدخول
                </Button>
              </form>
            </TabsContent>

            {/* Signup Tab */}
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">الاسم الكامل</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="محمد أحمد"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="example@email.com"
                    required
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">كلمة المرور</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    يجب أن تكون 6 أحرف على الأقل
                  </p>
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : null}
                  إنشاء حساب
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        </div>
      </div>
    </div>
  );
}

