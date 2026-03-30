/**
 * QUR'AN WORLD VIEW — i18n.js
 * ─────────────────────────────────────────────────────────────
 * Translation function t() and language state management.
 *
 * Language resolution order:
 *  1. Context: Public website always boots to 'en'
 *  2. Once logged in: Firebase users/{uid}.language takes over
 *  3. Fallback chain: requested lang → 'en' → raw key
 *
 * RULE: Every visible UI string passes through t().
 * RULE: Never hardcode UI text in any JS or HTML file.
 * RULE: Bolchaal Principle — all Hindi/Urdu must be spoken register.
 *
 * Supported languages: 'en' | 'hi' | 'ur'
 * ─────────────────────────────────────────────────────────────
 */

// ── Language state ───────────────────────────────────────────
// Public website default is 'en'. Dashboard switches to user pref.
let _lang = localStorage.getItem('qwv_lang') || 'en';

// ── Public API ───────────────────────────────────────────────

/** Returns the current active language code */
export function getLang() {
  return _lang;
}

/**
 * setLang(lang)
 * Changes the active language, persists to localStorage,
 * and optionally syncs to Firebase if user is logged in.
 * Dispatches 'qwv:lang-changed' event so components can re-render.
 */
export function setLang(lang, { syncToFirebase = false, uid = null } = {}) {
  if (!['en', 'hi', 'ur'].includes(lang)) return;
  _lang = lang;
  localStorage.setItem('qwv_lang', lang);

  // Update <html> lang attribute for accessibility
  document.documentElement.lang = lang === 'ur' ? 'ur' : lang === 'hi' ? 'hi' : 'en';
  document.documentElement.dir  = lang === 'ur' ? 'rtl' : 'ltr';

  if (syncToFirebase && uid) {
    // Fire-and-forget — non-critical
    import('./firebase.js').then(({ db, COLLECTIONS }) => {
      db.collection(COLLECTIONS.USERS).doc(uid)
        .update({ language: lang })
        .catch(err => console.warn('[QWV i18n] Firebase lang sync failed:', err));
    });
  }

  window.dispatchEvent(new CustomEvent('qwv:lang-changed', { detail: { lang } }));
}

/**
 * t(key, vars)
 * Returns the translated string for the current language.
 * Falls back to 'en', then to the raw key.
 *
 * Supports simple variable substitution:
 *   t('welcome_user', { name: 'Yusuf' })
 *   → "Welcome, Yusuf!" (if string is "Welcome, {{name}}!")
 */
export function t(key, vars = {}) {
  const str =
    STRINGS[_lang]?.[key] ??
    STRINGS['en']?.[key] ??
    key;

  if (!vars || Object.keys(vars).length === 0) return str;

  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

// ── String table ─────────────────────────────────────────────
// All UI strings for the QWV public website and dashboard.
// Keys are snake_case. Values follow the Bolchaal Principle for hi/ur.
//
// IMPORTANT FOR CONTRIBUTORS:
//   - hi: Hindustani — Urdu-origin vocabulary in Devanagari. NOT Sanskrit-heavy textbook Hindi.
//   - ur: Simple spoken Urdu — never overly formal or literary.
//   - Never use English loanwords in ur strings if a natural Urdu word exists.

const STRINGS = {

  // ── English ──────────────────────────────────────────────
  en: {

    // Nav
    nav_home:          'Home',
    nav_journey:       'Journey',
    nav_apps:          'Apps',
    nav_library:       'Library',
    nav_blog:          'Blog',
    nav_testimonials:  'Testimonials',
    nav_about:         'About',
    nav_contact:       'Contact',
    nav_login:         'Sign In',
    nav_dashboard:     'Dashboard',
    nav_logout:        'Sign Out',

    // Hero / General CTAs
    begin_journey:     'Begin the Journey',
    explore_journey:   'Explore the Journey',
    learn_more:        'Learn More',
    read_more:         'Read More',
    view_all:          'View All',
    back:              'Back',
    next:              'Next',
    previous:          'Previous',
    submit:            'Submit',
    save:              'Save',
    cancel:            'Cancel',
    close:             'Close',
    loading:           'Loading…',
    error_generic:     'Something went wrong. Please try again.',
    retry:             'Try Again',

    // Mantra / Brand
    mantra:            'We are not making scholars. We are making thinkers.',
    tagline:           'A transformational journey through the Qur\'an.',

    // Stages
    stage_label:       'Stage {{n}} of 5',
    stage_1_name:      'Iqra',
    stage_1_arabic:    'اِقْرَأ',
    stage_1_role:      'Read — build the daily Qur\'an habit',
    stage_2_name:      'Alif',
    stage_2_arabic:    'أَلِف',
    stage_2_role:      'Learn — Arabic on-ramp',
    stage_3_name:      'Aamaal',
    stage_3_arabic:    'أَعْمَال',
    stage_3_role:      'Act — habit and character tracker',
    stage_4_name:      'Ahad',
    stage_4_arabic:    'أَحَد',
    stage_4_role:      'Study — one month, one surah, one community',
    stage_5_name:      'Miftah',
    stage_5_arabic:    'مِفْتَاح',
    stage_5_role:      'Master — independent Qur\'anic thinking',

    // Gate
    gate_rule:         'Each stage is earned, not bought.',
    gate_locked:       'Locked',
    gate_pending:      'Your progress has been noted. Awaiting confirmation.',
    gate_unlocked:     'Open',
    gate_unlock_cta:   'Open {{app}}',

    // Dashboard
    dashboard_welcome:     'As-salamu alaykum, {{name}}.',
    dashboard_your_journey:'Your Journey',
    dashboard_stage_progress: 'Lesson {{current}} of {{total}}',
    dashboard_streak:      '{{n}}-day streak',
    dashboard_gems:        '{{n}} gems in the Library',
    dashboard_reflect:     'Reflect',
    dashboard_reflect_prompt: 'What did the Qur\'an say to you today?',
    dashboard_reflection_title_placeholder: 'Title your reflection…',
    dashboard_reflection_body_placeholder:  'Write your reflection here…',
    dashboard_publish_named:    'Publish as {{name}}',
    dashboard_publish_anon:     'Publish anonymously',
    dashboard_submit_reflection:'Submit Reflection',
    dashboard_reflection_pending:   'Submitted — awaiting review.',
    dashboard_reflection_approved:  'Approved.',
    dashboard_reflection_published: 'Published to the Library.',
    dashboard_no_reflections:  'You haven\'t submitted any reflections yet.',
    dashboard_founder_insights:'Founder\'s Notes',

    // Member tiers
    tier_student:  'Student',
    tier_sabiqun:  'Early Access',
    tier_core:     'Core Member',
    tier_admin:    'Admin',

    // Login
    login_title:        'Welcome back.',
    login_subtitle:     'Sign in to continue your journey.',
    login_email:        'Email address',
    login_password:     'Password',
    login_cta:          'Sign In',
    login_forgot:       'Forgot password?',
    login_reset_title:  'Reset your password',
    login_reset_email:  'Enter your email address',
    login_reset_cta:    'Send Reset Link',
    login_reset_sent:   'Check your email for a reset link.',
    login_back_to_login:'Back to sign in',

    // Sign up
    signup_title:        'Create your account.',
    signup_subtitle:     'Begin your journey with Qur\'an World View.',
    signup_name:         'Your name',
    signup_name_placeholder: 'e.g. Yusuf Khan',
    signup_email:        'Email address',
    signup_password:     'Create a password',
    signup_cta:          'Create Account',
    signup_have_account: 'Already have an account? Sign in',
    auth_error_email_in_use: 'An account with this email already exists.',
    auth_error_weak_password: 'Password must be at least 6 characters.',

    // Auth errors
    auth_error_not_found:     'No account found with this email.',
    auth_error_wrong_password:'Incorrect password.',
    auth_error_invalid_email: 'Please enter a valid email address.',
    auth_error_disabled:      'This account has been disabled.',
    auth_error_too_many:      'Too many attempts. Please try again later.',
    auth_error_network:       'Network error. Please check your connection.',
    auth_error_generic:       'Sign-in failed. Please try again.',

    // Ayah of the Day
    ayah_of_day:        'Ayah of the Day',
    ayah_view_social:   'View on {{platform}}',

    // Blog
    blog_title:         'Reflections',
    blog_by:            'By {{author}}',
    blog_published:     'Published {{date}}',

    // Library
    library_title:      'QWV Library',
    library_tagline:    'A living record of Qur\'anic worldviews.',
    library_gems:       '{{n}} gems',
    library_license:    'All content licensed CC BY-NC-ND.',

    // Testimonials
    testimonials_title: 'Student Voices',

    // About
    about_title:        'Our Mission',
    about_principles:   'Guiding Principles',
    about_full_story:   'Our Full Story',

    // Contact
    contact_title:      'Get in Touch',
    contact_name:       'Your name',
    contact_email:      'Your email',
    contact_message:    'Your message',
    contact_send:       'Send Message',
    contact_sent:       'Message sent. JazakAllah khayran.',

    // Footer
    footer_license:     'QWV Library content: CC BY-NC-ND',
    footer_contact:     'Contact',
    footer_instagram:   'Instagram',
    footer_youtube:     'YouTube',

    // Theme
    theme_dark:   'Dark',
    theme_light:  'Light',
    theme_system: 'System',

    // PWA / offline
    offline_banner: 'You\'re offline. Some content may not be available.',

    // Misc
    and: 'and',
    or:  'or',
    by:  'by',
  },

  // ── Hindi (Hindustani — Bolchaal) ────────────────────────
  // Devanagari script. Urdu-origin vocabulary. NOT Sanskrit-heavy.
  hi: {

    // Nav
    nav_home:          'होम',
    nav_journey:       'सफ़र',
    nav_apps:          'ऐप्स',
    nav_library:       'लाइब्रेरी',
    nav_blog:          'ब्लॉग',
    nav_testimonials:  'आवाज़ें',
    nav_about:         'हमारे बारे में',
    nav_contact:       'संपर्क',
    nav_login:         'लॉग इन',
    nav_dashboard:     'डैशबोर्ड',
    nav_logout:        'लॉग आउट',

    // Hero / General CTAs
    begin_journey:     'सफ़र शुरू करें',
    explore_journey:   'सफ़र देखें',
    learn_more:        'और जानें',
    read_more:         'पूरा पढ़ें',
    view_all:          'सब देखें',
    back:              'वापस',
    next:              'आगे',
    previous:          'पीछे',
    submit:            'भेजें',
    save:              'सेव करें',
    cancel:            'रद्द करें',
    close:             'बंद करें',
    loading:           'लोड हो रहा है…',
    error_generic:     'कुछ गड़बड़ हो गई। दोबारा कोशिश करें।',
    retry:             'दोबारा कोशिश करें',

    // Mantra / Brand
    mantra:            'हम आलिम नहीं बना रहे। हम सोचने वाले बना रहे हैं।',
    tagline:           'क़ुरआन के साथ एक तब्दीली का सफ़र।',

    // Stages
    stage_label:       'मरहला {{n}} / 5',
    stage_1_name:      'इक़रा',
    stage_1_arabic:    'اِقْرَأ',
    stage_1_role:      'पढ़ो — रोज़ाना क़ुरआन की आदत बनाओ',
    stage_2_name:      'अलिफ़',
    stage_2_arabic:    'أَلِف',
    stage_2_role:      'सीखो — अरबी सीखने की शुरुआत',
    stage_3_name:      'आमाल',
    stage_3_arabic:    'أَعْمَال',
    stage_3_role:      'करो — आदत और किरदार का ट्रैकर',
    stage_4_name:      'अहद',
    stage_4_arabic:    'أَحَد',
    stage_4_role:      'पढ़ो — एक महीना, एक सूरह, एक जमात',
    stage_5_name:      'मिफ़्ताह',
    stage_5_arabic:    'مِفْتَاح',
    stage_5_role:      'महारत हासिल करो — आज़ाद क़ुरआनी सोच',

    // Gate
    gate_rule:         'हर मरहला कमाना पड़ता है, ख़रीदा नहीं जाता।',
    gate_locked:       'बंद है',
    gate_pending:      'आपकी मेहनत नोट हो गई। तसदीक़ का इंतज़ार है।',
    gate_unlocked:     'खुला है',
    gate_unlock_cta:   '{{app}} खोलें',

    // Dashboard
    dashboard_welcome:     'अस्सलामु अलैकुम, {{name}}।',
    dashboard_your_journey:'आपका सफ़र',
    dashboard_stage_progress: 'दर्स {{current}} / {{total}}',
    dashboard_streak:      '{{n}} दिन का सिलसिला',
    dashboard_gems:        'लाइब्रेरी में {{n}} नगीने',
    dashboard_reflect:     'ग़ौर करें',
    dashboard_reflect_prompt: 'आज क़ुरआन ने आपसे क्या कहा?',
    dashboard_reflection_title_placeholder: 'अपने ख़याल को एक नाम दें…',
    dashboard_reflection_body_placeholder:  'यहाँ लिखें…',
    dashboard_publish_named:    '{{name}} के नाम से शाया करें',
    dashboard_publish_anon:     'गुमनाम रहें',
    dashboard_submit_reflection:'भेजें',
    dashboard_reflection_pending:   'भेज दिया — जाँच हो रही है।',
    dashboard_reflection_approved:  'मंज़ूर हो गया।',
    dashboard_reflection_published: 'लाइब्रेरी में शाया हो गया।',
    dashboard_no_reflections:  'अभी तक कोई तहरीर नहीं भेजी।',
    dashboard_founder_insights:'बानी के नोट्स',

    // Member tiers
    tier_student:  'तालिब',
    tier_sabiqun:  'अर्ली एक्सेस',
    tier_core:     'कोर मेंबर',
    tier_admin:    'एडमिन',

    // Login
    login_title:        'ख़ुश आमदीद।',
    login_subtitle:     'अपना सफ़र जारी रखने के लिए लॉग इन करें।',
    login_email:        'ईमेल',
    login_password:     'पासवर्ड',
    login_cta:          'लॉग इन करें',
    login_forgot:       'पासवर्ड भूल गए?',
    login_reset_title:  'पासवर्ड रीसेट करें',
    login_reset_email:  'अपनी ईमेल डालें',
    login_reset_cta:    'रीसेट लिंक भेजें',
    login_reset_sent:   'आपकी ईमेल पर लिंक भेज दिया गया है।',
    login_back_to_login:'लॉग इन पर वापस जाएं',

    // Sign up
    signup_title:        'अकाउंट बनाएं।',
    signup_subtitle:     'क़ुरआन वर्ल्ड व्यू के साथ अपना सफ़र शुरू करें।',
    signup_name:         'आपका नाम',
    signup_name_placeholder: 'जैसे: यूसुफ़ ख़ान',
    signup_email:        'ईमेल',
    signup_password:     'पासवर्ड बनाएं',
    signup_cta:          'अकाउंट बनाएं',
    signup_have_account: 'पहले से अकाउंट है? लॉग इन करें',
    auth_error_email_in_use: 'इस ईमेल से पहले से अकाउंट है।',
    auth_error_weak_password: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए।',

    // Auth errors
    auth_error_not_found:     'इस ईमेल से कोई अकाउंट नहीं मिला।',
    auth_error_wrong_password:'पासवर्ड ग़लत है।',
    auth_error_invalid_email: 'सही ईमेल डालें।',
    auth_error_disabled:      'यह अकाउंट बंद कर दिया गया है।',
    auth_error_too_many:      'बहुत ज़्यादा कोशिशें हो गईं। थोड़ी देर बाद कोशिश करें।',
    auth_error_network:       'नेटवर्क की दिक्क़त है। कनेक्शन चेक करें।',
    auth_error_generic:       'लॉग इन नहीं हो सका। दोबारा कोशिश करें।',

    // Ayah of the Day
    ayah_of_day:        'आज की आयत',
    ayah_view_social:   '{{platform}} पर देखें',

    // Blog
    blog_title:         'तहरीरें',
    blog_by:            '{{author}} की तरफ़ से',
    blog_published:     '{{date}} को शाया हुआ',

    // Library
    library_title:      'QWV लाइब्रेरी',
    library_tagline:    'क़ुरआनी नज़रियों का एक ज़िंदा ख़ज़ाना।',
    library_gems:       '{{n}} नगीने',
    library_license:    'सारा मवाद CC BY-NC-ND लाइसेंस के तहत है।',

    // Testimonials
    testimonials_title: 'तालिबों की आवाज़ें',

    // About
    about_title:        'हमारा मक़सद',
    about_principles:   'रहनुमा उसूल',
    about_full_story:   'पूरी कहानी',

    // Contact
    contact_title:      'बात करें',
    contact_name:       'आपका नाम',
    contact_email:      'आपकी ईमेल',
    contact_message:    'आपका पैग़ाम',
    contact_send:       'भेजें',
    contact_sent:       'पैग़ाम पहुँच गया। जज़ाकअल्लाह ख़ैरन।',

    // Footer
    footer_license:     'QWV लाइब्रेरी: CC BY-NC-ND',
    footer_contact:     'संपर्क',
    footer_instagram:   'इंस्टाग्राम',
    footer_youtube:     'यूट्यूब',

    // Theme
    theme_dark:   'डार्क',
    theme_light:  'लाइट',
    theme_system: 'सिस्टम',

    // PWA / offline
    offline_banner: 'आप ऑफ़लाइन हैं। कुछ चीज़ें नहीं दिखेंगी।',

    // Misc
    and: 'और',
    or:  'या',
    by:  'की तरफ़ से',
  },

  // ── Urdu ──────────────────────────────────────────────────
  // Simple spoken Urdu — Nastaliq not required in code, Urdu script only.
  ur: {

    // Nav
    nav_home:          'ہوم',
    nav_journey:       'سفر',
    nav_apps:          'ایپس',
    nav_library:       'لائبریری',
    nav_blog:          'بلاگ',
    nav_testimonials:  'آوازیں',
    nav_about:         'ہمارے بارے میں',
    nav_contact:       'رابطہ',
    nav_login:         'لاگ اِن',
    nav_dashboard:     'ڈیش بورڈ',
    nav_logout:        'لاگ آؤٹ',

    // Hero / General CTAs
    begin_journey:     'سفر شروع کریں',
    explore_journey:   'سفر دیکھیں',
    learn_more:        'مزید جانیں',
    read_more:         'پورا پڑھیں',
    view_all:          'سب دیکھیں',
    back:              'واپس',
    next:              'آگے',
    previous:          'پیچھے',
    submit:            'بھیجیں',
    save:              'سیو کریں',
    cancel:            'رد کریں',
    close:             'بند کریں',
    loading:           'لوڈ ہو رہا ہے…',
    error_generic:     'کچھ گڑبڑ ہو گئی۔ دوبارہ کوشش کریں۔',
    retry:             'دوبارہ کوشش کریں',

    // Mantra / Brand
    mantra:            'ہم عالم نہیں بنا رہے۔ ہم سوچنے والے بنا رہے ہیں۔',
    tagline:           'قرآن کے ساتھ ایک تبدیلی کا سفر۔',

    // Stages
    stage_label:       'مرحلہ {{n}} / 5',
    stage_1_name:      'اقرا',
    stage_1_arabic:    'اِقْرَأ',
    stage_1_role:      'پڑھو — روزانہ قرآن کی عادت بناؤ',
    stage_2_name:      'الف',
    stage_2_arabic:    'أَلِف',
    stage_2_role:      'سیکھو — عربی سیکھنے کی شروعات',
    stage_3_name:      'اعمال',
    stage_3_arabic:    'أَعْمَال',
    stage_3_role:      'کرو — عادت اور کردار کا ٹریکر',
    stage_4_name:      'احد',
    stage_4_arabic:    'أَحَد',
    stage_4_role:      'پڑھو — ایک مہینہ، ایک سورہ، ایک جماعت',
    stage_5_name:      'مفتاح',
    stage_5_arabic:    'مِفْتَاح',
    stage_5_role:      'مہارت حاصل کرو — آزاد قرآنی سوچ',

    // Gate
    gate_rule:         'ہر مرحلہ کمانا پڑتا ہے، خریدا نہیں جاتا۔',
    gate_locked:       'بند ہے',
    gate_pending:      'آپ کی محنت نوٹ ہو گئی۔ تصدیق کا انتظار ہے۔',
    gate_unlocked:     'کھلا ہے',
    gate_unlock_cta:   '{{app}} کھولیں',

    // Dashboard
    dashboard_welcome:     'السلام علیکم، {{name}}۔',
    dashboard_your_journey:'آپ کا سفر',
    dashboard_stage_progress: 'سبق {{current}} / {{total}}',
    dashboard_streak:      '{{n}} دن کا سلسلہ',
    dashboard_gems:        'لائبریری میں {{n}} نگینے',
    dashboard_reflect:     'غور کریں',
    dashboard_reflect_prompt: 'آج قرآن نے آپ سے کیا کہا؟',
    dashboard_reflection_title_placeholder: 'اپنے خیال کو ایک نام دیں…',
    dashboard_reflection_body_placeholder:  'یہاں لکھیں…',
    dashboard_publish_named:    '{{name}} کے نام سے شائع کریں',
    dashboard_publish_anon:     'گمنام رہیں',
    dashboard_submit_reflection:'بھیجیں',
    dashboard_reflection_pending:   'بھیج دیا — جانچ ہو رہی ہے۔',
    dashboard_reflection_approved:  'منظور ہو گیا۔',
    dashboard_reflection_published: 'لائبریری میں شائع ہو گیا۔',
    dashboard_no_reflections:  'ابھی تک کوئی تحریر نہیں بھیجی۔',
    dashboard_founder_insights:'بانی کے نوٹس',

    // Member tiers
    tier_student:  'طالب',
    tier_sabiqun:  'ارلی ایکسس',
    tier_core:     'کور ممبر',
    tier_admin:    'ایڈمن',

    // Login
    login_title:        'خوش آمدید۔',
    login_subtitle:     'اپنا سفر جاری رکھنے کے لیے لاگ اِن کریں۔',
    login_email:        'ای میل',
    login_password:     'پاس ورڈ',
    login_cta:          'لاگ اِن کریں',
    login_forgot:       'پاس ورڈ بھول گئے؟',
    login_reset_title:  'پاس ورڈ ری سیٹ کریں',
    login_reset_email:  'اپنی ای میل ڈالیں',
    login_reset_cta:    'ری سیٹ لنک بھیجیں',
    login_reset_sent:   'آپ کی ای میل پر لنک بھیج دیا گیا ہے۔',
    login_back_to_login:'لاگ اِن پر واپس جائیں',

    // Sign up
    signup_title:        'اکاؤنٹ بنائیں۔',
    signup_subtitle:     'قرآن ورلڈ ویو کے ساتھ اپنا سفر شروع کریں۔',
    signup_name:         'آپ کا نام',
    signup_name_placeholder: 'مثلاً: یوسف خان',
    signup_email:        'ای میل',
    signup_password:     'پاس ورڈ بنائیں',
    signup_cta:          'اکاؤنٹ بنائیں',
    signup_have_account: 'پہلے سے اکاؤنٹ ہے؟ لاگ اِن کریں',
    auth_error_email_in_use: 'اس ای میل سے پہلے سے اکاؤنٹ موجود ہے۔',
    auth_error_weak_password: 'پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔',

    // Auth errors
    auth_error_not_found:     'اس ای میل سے کوئی اکاؤنٹ نہیں ملا۔',
    auth_error_wrong_password:'پاس ورڈ غلط ہے۔',
    auth_error_invalid_email: 'صحیح ای میل ڈالیں۔',
    auth_error_disabled:      'یہ اکاؤنٹ بند کر دیا گیا ہے۔',
    auth_error_too_many:      'بہت زیادہ کوششیں ہو گئیں۔ تھوڑی دیر بعد کوشش کریں۔',
    auth_error_network:       'نیٹ ورک کی دقت ہے۔ کنکشن چیک کریں۔',
    auth_error_generic:       'لاگ اِن نہیں ہو سکا۔ دوبارہ کوشش کریں۔',

    // Ayah of the Day
    ayah_of_day:        'آج کی آیت',
    ayah_view_social:   '{{platform}} پر دیکھیں',

    // Blog
    blog_title:         'تحریریں',
    blog_by:            '{{author}} کی طرف سے',
    blog_published:     '{{date}} کو شائع ہوا',

    // Library
    library_title:      'QWV لائبریری',
    library_tagline:    'قرآنی نظریوں کا ایک زندہ خزانہ۔',
    library_gems:       '{{n}} نگینے',
    library_license:    'سارا مواد CC BY-NC-ND لائسنس کے تحت ہے۔',

    // Testimonials
    testimonials_title: 'طلبا کی آوازیں',

    // About
    about_title:        'ہمارا مقصد',
    about_principles:   'رہنما اصول',
    about_full_story:   'پوری کہانی',

    // Contact
    contact_title:      'بات کریں',
    contact_name:       'آپ کا نام',
    contact_email:      'آپ کی ای میل',
    contact_message:    'آپ کا پیغام',
    contact_send:       'بھیجیں',
    contact_sent:       'پیغام پہنچ گیا۔ جزاک اللہ خیراً۔',

    // Footer
    footer_license:     'QWV لائبریری: CC BY-NC-ND',
    footer_contact:     'رابطہ',
    footer_instagram:   'انسٹاگرام',
    footer_youtube:     'یوٹیوب',

    // Theme
    theme_dark:   'ڈارک',
    theme_light:  'لائٹ',
    theme_system: 'سسٹم',

    // PWA / offline
    offline_banner: 'آپ آف لائن ہیں۔ کچھ چیزیں نہیں دکھیں گی۔',

    // Misc
    and: 'اور',
    or:  'یا',
    by:  'کی طرف سے',
  },
};

// ── Named export for raw access (rare, prefer t()) ───────────
export { STRINGS };
