import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Bot,
  MessageSquare,
  Sparkles,
  Zap,
  Globe,
  Shield,
  CheckCircle2,
  ArrowLeft,
  BookOpen,
  Users,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "بوت ذكي بالعربية",
    desc: "ردود طبيعية بلهجتك المفضلة مدعومة بأحدث نماذج الذكاء الاصطناعي.",
  },
  {
    icon: BookOpen,
    title: "قاعدة معرفة شاملة",
    desc: "درّب بوتك من نصوص، ملفات، روابط، وصور وصفحات تواصل اجتماعي.",
  },
  {
    icon: MessageSquare,
    title: "قنوات متعددة",
    desc: "تيليجرام، واتساب، فيسبوك وانستجرام من لوحة واحدة موحدة.",
  },
  {
    icon: Users,
    title: "إدارة العملاء",
    desc: "ملفات تعريف تلقائية لكل عميل مع سجل المحادثات والتصنيف.",
  },
  {
    icon: BarChart3,
    title: "تحليلات لحظية",
    desc: "تابع الأداء، معدل النجاح، وعدد الرسائل في الوقت الفعلي.",
  },
  {
    icon: Shield,
    title: "أمان وخصوصية",
    desc: "بياناتك محمية بأعلى معايير الأمان مع عزل كامل بين الحسابات.",
  },
];

const steps = [
  { n: "1", title: "أنشئ حسابك", desc: "سجّل مجاناً في أقل من دقيقة." },
  { n: "2", title: "درّب بوتك", desc: "أضف معلومات عملك ومنتجاتك بسهولة." },
  { n: "3", title: "اربط قنواتك", desc: "فعّل البوت على واتساب وتيليجرام وغيرها." },
  { n: "4", title: "ابدأ البيع", desc: "دع البوت يجيب عملاءك 24/7 ويغلق الصفقات." },
];

const benefits = [
  "إعداد سريع بدون أي خبرة تقنية",
  "دعم كامل للغة العربية وجميع اللهجات",
  "تكامل مباشر مع منصات التواصل الاجتماعي",
  "تحويل المحادثات لموظف بشري عند الحاجة",
  "تحديث المعرفة من صفحاتك تلقائياً",
  "بدون رسوم خفية — جرّب مجاناً الآن",
];

export default function Landing() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">جوابي</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">المميزات</a>
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">كيف يعمل</a>
            <a href="#cta" className="text-sm text-muted-foreground hover:text-foreground">ابدأ الآن</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth?mode=signup">تجربة مجانية</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-soft)" }}
        />
        <div
          aria-hidden
          className="absolute -top-32 right-1/2 -z-10 h-[500px] w-[500px] translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              منصة عربية لإنشاء بوتات الذكاء الاصطناعي
            </div>
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              بوت ذكاء اصطناعي يرد على عملاءك
              <span className="block bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                بالعربية، على مدار الساعة
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              أنشئ مساعدك الذكي خلال دقائق، اربطه بواتساب وتيليجرام وفيسبوك،
              ودعه يجيب أسئلة عملاءك ويزيد مبيعاتك تلقائياً.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-w-56 text-base">
                <Link to="/auth?mode=signup">
                  ابدأ تجربتك المجانية
                  <ArrowLeft className="ms-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-w-56 text-base">
                <a href="#features">شاهد المميزات</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              بدون بطاقة ائتمان • إعداد فوري • إلغاء في أي وقت
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">كل ما تحتاجه لخدمة عملاءك</h2>
          <p className="mt-4 text-muted-foreground">
            منصة متكاملة تجمع بين الذكاء الاصطناعي وسهولة الاستخدام.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="group p-6 transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-secondary/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">ابدأ في 4 خطوات بسيطة</h2>
            <p className="mt-4 text-muted-foreground">من الصفر إلى بوت يعمل في أقل من 10 دقائق.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="mb-2 font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">لماذا جوابي؟</h2>
            <p className="mt-4 text-muted-foreground">
              صُمم خصيصاً للسوق العربي مع فهم عميق للهجات واحتياجات الأعمال المحلية.
            </p>
            <ul className="mt-6 space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="text-sm">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="overflow-hidden border-2 p-0">
            <div className="border-b border-border bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
              محادثة مباشرة • مثال
            </div>
            <div className="space-y-3 p-6">
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-secondary px-4 py-2 text-sm">
                  السلام عليكم، هل المنتج متوفر؟
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                  وعليكم السلام 👋 نعم متوفر بجميع المقاسات والألوان. تحب أرسلك الكتالوج؟
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-secondary px-4 py-2 text-sm">
                  أكيد، وكم سعر التوصيل؟
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                  التوصيل مجاني للطلبات فوق 200 ريال 🚚
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section id="cta" className="container mx-auto px-4 pb-24">
        <div
          className="relative overflow-hidden rounded-2xl px-8 py-16 text-center text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Globe className="absolute -bottom-10 -left-10 h-48 w-48 opacity-10" />
          <Sparkles className="absolute -top-6 -right-6 h-32 w-32 opacity-10" />
          <h2 className="text-3xl font-bold md:text-4xl">جرّب جوابي مجاناً اليوم</h2>
          <p className="mx-auto mt-4 max-w-xl opacity-90">
            انضم لمئات الشركات التي تستخدم جوابي لخدمة عملاءها وزيادة مبيعاتها.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" variant="secondary" className="min-w-56 text-base">
              <Link to="/auth?mode=signup">
                ابدأ تجربتك المجانية
                <ArrowLeft className="ms-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-semibold">جوابي</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} جوابي. جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>
    </div>
  );
}