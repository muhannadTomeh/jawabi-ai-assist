
# جلب محتوى فيسبوك/إنستغرام إلى قاعدة المعرفة

## الفكرة
في تبويب "رابط ويب" داخل نافذة إضافة محتوى، نضيف تبويب جديد "صفحة سوشيال" يسمح للمستخدم باختيار صفحة من **الصفحات المربوطة مسبقاً** (الموجودة في `social_connections`) وجلب محتواها رسمياً عبر **Meta Graph API** باستخدام `access_token` المخزّن في القاعدة. لا scraping ولا روابط عامة — فقط الصفحات التي ربطها المستخدم في صفحة "القنوات".

## ما يُجلب
لكل صفحة مربوطة:
1. **معلومات الصفحة**: `about`, `bio`, `description`, `category`, `hours`, `phone`, `emails`, `website`, `location`.
2. **آخر المنشورات** (نصوص فقط): آخر 25 منشوراً من `/posts` (Facebook) أو `/media` مع `caption` (Instagram).
3. **المنتجات/الأسعار**: إن وجد كتالوج عبر `/product_catalogs` (اختياري — يُتجاهل إن لم تتوفر صلاحية).

كل عنصر يُحفظ كسجل مستقل في `knowledge_items` بنوع `social` وعنوان واضح مثل "صفحة فيسبوك — معلومات" أو "إنستغرام — منشور 2026-05-12".

## التحديث الدوري
- إضافة عمود `auto_sync` (boolean) و `last_synced_at` (timestamptz) و `source_ref` (text — يحمل `social_connections.id` للإشارة) إلى `knowledge_items`.
- جدولة **pg_cron** يومياً يستدعي Edge Function `sync-social-knowledge` التي:
  - تمر على كل `social_connections` المرتبط بسجلات `knowledge_items` ذات `auto_sync=true`.
  - تحذف السجلات القديمة من نوع `social` لتلك الصفحة وتعيد إنشاءها بأحدث محتوى.
- زر يدوي "مزامنة الآن" في الواجهة بجانب كل عنصر `social`.

## التغييرات المطلوبة

### 1. قاعدة البيانات (migration)
- `ALTER TABLE knowledge_items ADD COLUMN auto_sync boolean DEFAULT false, ADD COLUMN last_synced_at timestamptz, ADD COLUMN source_ref text;`
- تفعيل `pg_cron` و `pg_net` وجدولة مهمة يومية تستدعي الـ Edge Function.

### 2. Edge Function جديدة: `supabase/functions/fetch-social-content/index.ts`
- تستقبل: `{ connection_id, auto_sync?: boolean }`.
- تتحقق من JWT المستخدم + ملكية `social_connections` و `chatbot`.
- تستدعي Graph API حسب `platform`:
  - **facebook**: `GET /{page_id}?fields=about,bio,description,category,hours,phone,emails,website,location` و `GET /{page_id}/posts?fields=message,created_time&limit=25`.
  - **instagram**: `GET /{ig_user_id}?fields=biography,website,username` و `GET /{ig_user_id}/media?fields=caption,permalink,timestamp&limit=25`.
- تنسّق كل قطعة وتحفظها في `knowledge_items` مع `type='social'`, `source_ref=connection_id`, `auto_sync`.

### 3. Edge Function جديدة: `supabase/functions/sync-social-knowledge/index.ts`
- نقطة دخول للـ cron (بدون JWT — تتحقق من header سري `CRON_SECRET`).
- تجلب كل `source_ref` فريد له `auto_sync=true` ثم تستدعي منطق `fetch-social-content` لكل واحد.

### 4. تحديث الواجهة
- `src/components/knowledge/AddContentDialog.tsx`: تبويب رابع "صفحات السوشيال" يعرض `<Select>` بالصفحات المربوطة من `social_connections` (مع شارة المنصة)، خانة `Checkbox` "تحديث تلقائي يومياً"، وزر "جلب المحتوى". إن لم توجد صفحات مربوطة → رسالة + رابط لصفحة القنوات.
- `src/pages/KnowledgeBase.tsx`: إضافة `social` إلى `typeIcons` (أيقونة Facebook/Instagram من lucide) و `typeLabels`، وزر "🔄 مزامنة" في قائمة العنصر يستدعي `fetch-social-content` بنفس `source_ref`.

### 5. ملاحظات تقنية
- صلاحيات Graph API المطلوبة: `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `instagram_basic`, `instagram_manage_insights`. يجب التأكد أن `facebook-oauth` يطلبها أصلاً؛ إن كانت ناقصة سننبّه المستخدم لإعادة الربط.
- لا حاجة لأي API key جديد — `access_token` لكل صفحة موجود في `social_connections.access_token`.
- نص المنشورات يُمرّر كما هو إلى نفس RAG الموجود في `chat/index.ts` (الذي يدعم بالفعل قراءة `content` من `knowledge_items`).
- حد أقصى ~200KB لكل سجل لتجنب تضخم القاعدة.

## النتيجة للمستخدم
- يفتح "إضافة محتوى" → "صفحة سوشيال" → يختار صفحة الفيسبوك أو الإنستغرام المربوطة → يفعّل التحديث التلقائي → يضغط جلب.
- يظهر في قاعدة المعرفة عدة عناصر (معلومات الصفحة + كل منشور) ويتعلم منها البوت فوراً.
- يومياً يتم تحديث المحتوى تلقائياً دون تدخل.
