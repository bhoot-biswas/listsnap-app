import "server-only";
import type { BanglaText, GroupMode, ListingText, PlanResult } from "@/lib/schemas/pipeline";
import type { ListingStatus } from "@/server/db/scope";

/**
 * The three listings every "Try the demo" shop starts with. The photos were made with
 * Muse Image; the plans, SAM boxes, cutouts and English text are real model output
 * from running those photos through the pipeline, so the demo shows what the models
 * actually return. Files live in public/samples/ ({key}.jpg, {key}-{n}.jpg cutouts in
 * item order, {key}-studio.jpg), which also lets the Snap page offer them as samples.
 */

export interface DemoSample {
  key: "saree" | "kantha" | "tray";
  plan: PlanResult;
  /** SAM boxes in the 1600 px photo the models saw, left to right. */
  boxes: { x: number; y: number; w: number; h: number; score: number }[];
  mode: GroupMode;
  reason: string;
  colors: string[];
  status: ListingStatus;
  en: ListingText;
  bn: BanglaText;
}

export const SAMPLE_SOURCE_SIZE = 1600;

const box = (left: number, top: number, right: number, bottom: number, score: number) => ({
  x: left,
  y: top,
  w: right - left,
  h: bottom - top,
  score,
});

/** Oldest first, so the saree ends up as the most recent listing. */
export const DEMO_SAMPLES: DemoSample[] = [
  {
    key: "kantha",
    plan: {
      sam_phrase: "embroidered kantha quilt",
      alt_phrases: ["nakshi kantha", "kantha quilt", "embroidered bedsheet"],
      contents_phrases: [],
      category_guess: "Nakshi Kantha",
      likely_multi: false,
      item_count_guess: 1,
      multi_kind: "single",
      camera_angle: "angled",
      photo_notes: "Bright daylight on a worn wooden table with slightly tilted framing.",
      scene_brief: {
        setting: "Spread neatly over a simple wooden bed in a sunlit Bangladeshi bedroom.",
        palette: ["warm brown", "deep green"],
        avoid: ["pillows", "bedsheets", "other quilts"],
      },
    },
    boxes: [box(99, 139, 1492, 1377, 0.942)],
    mode: "single",
    reason: "One item.",
    colors: [],
    status: "needs_review",
    en: {
      title: "Off-White Embroidered Nakshi Kantha with Lotus Motif",
      short_description: "Off-white nakshi kantha quilt with lotus embroidery and colorful paisley border.",
      description:
        "Beautiful off-white nakshi kantha quilt with a striking lotus flower in the centre. The paisley border in yellow, blue and red adds a classic traditional touch.\nLightweight layered feel typical of kantha quilts, good as a throw or light cover. See photos for detail on texture and stitching.\nShown folded on a table - see photos for embroidery placement and overall look. Lovely for cozy bedrooms and living spaces.\nGentle hand wash recommended to keep the embroidery fresh. Suits anyone who loves traditional handwork and soft neutral bedding.",
      category: "Nakshi Kantha",
      attributes: [
        { name: "Color", value: "Off-white / cream" },
        { name: "Design", value: "Central lotus with paisley border" },
        { name: "Embroidery Colors", value: "Yellow, blue and red" },
        { name: "Type", value: "Folded kantha quilt / throw" },
      ],
      tags: [
        "nakshi kantha",
        "kantha quilt",
        "embroidered quilt",
        "lotus kantha",
        "paisley border",
        "cotton throw",
        "desi blanket",
        "handwork quilt",
      ],
      price_hint_bdt: {
        low: 2500,
        high: 5500,
        basis: "Hand-style embroidered cotton kantha with detailed border work",
      },
      confidence: 0.72,
      check_notes: [
        "Check fabric composition and number of layers",
        "Check exact length and width when opened flat",
        "Check if hand-embroidered or machine-embroidered",
        "Check wash care and single or double size",
      ],
    },
    bn: {
      title: "অফ-হোয়াইট সুতোয় বোনা পদ্মফুল নকশি কাঁথা",
      short_description: "অফ-হোয়াইট নকশি কাঁথা কুইল্ট, পদ্মফুলের সেলাই আর রঙিন কলকা পাড় দেওয়া।",
      description:
        "কী সুন্দর অফ-হোয়াইট নকশি কাঁথা কুইল্ট, একদম মাঝখানে বড় পদ্মফুলের নকশা করা। চারপাশে হলুদ, নীল আর লাল রঙের কলকা পাড় দেওয়াতে একদম খাঁটি সাবেকি লুক এসেছে।\nকাঁথা কুইল্ট যেমন হয় হালকা আর আরামদায়ক, সোফায় গায়ে দিতে বা হালকা কাঁথা হিসেবে দারুণ লাগবে। সেলাই আর কাপড়ের বুনন কাছ থেকে দেখতে ছবিগুলো দেখে নিন।\nটেবিলের উপর ভাঁজ করে রাখা ছবি দেওয়া আছে, নকশা কোথায় কীভাবে বসেছে আর পুরোটা দেখতে কেমন লাগবে বুঝতে পারবেন। আরামদায়ক শোবার ঘর আর বসার ঘরের জন্য খুব মানাবে।\nসেলাই ভালো রাখতে হালকা হাতে ধুয়ে নেওয়াই ভালো। যারা হাতের কাজ আর হালকা নিরপেক্ষ রঙের বিছানা পছন্দ করেন তাদের খুব পছন্দ হবে।",
      attributes: [
        { name: "রং", value: "অফ-হোয়াইট / ক্রিম" },
        { name: "ডিজাইন", value: "মাঝখানে পদ্মফুল আর চারপাশে কলকা পাড়" },
        { name: "সেলাইয়ের রং", value: "হলুদ, নীল আর লাল" },
        { name: "ধরন", value: "ভাঁজ করা কাঁথা কুইল্ট / গায়ে দেওয়ার চাদর" },
      ],
      tags: [
        "নকশি কাঁথা",
        "কাঁথা কুইল্ট",
        "পদ্মফুল কাঁথা",
        "হাতের কাজের কাঁথা",
        "কলকা পাড়",
        "nakshi kantha",
        "kantha quilt",
        "cotton throw",
      ],
      check_notes: [
        "কাপড় কী সুতার আর কয় পরত আছে দেখে নিন",
        "পুরো মেলে ধরলে লম্বা আর চওড়া ঠিক কতটুকু মেপে নিন",
        "হাতে সেলাই করা নাকি মেশিনে সেলাই করা যাচাই করুন",
        "ধোয়ার নিয়ম আর সিঙ্গেল না ডাবল সাইজ দেখে নিন",
      ],
    },
  },
  {
    key: "tray",
    plan: {
      sam_phrase: "painted tray",
      alt_phrases: ["decorative plate", "hand-painted thala"],
      contents_phrases: [],
      category_guess: "Home decor",
      likely_multi: false,
      item_count_guess: 1,
      multi_kind: "single",
      camera_angle: "top_down",
      photo_notes: "Sharp top-down photo on a plain wooden surface in even daylight.",
      scene_brief: {
        setting: "Centered on a polished wooden dining table in a bright Bangladeshi home with soft morning light.",
        palette: ["beige", "brown", "cream"],
        avoid: ["food", "tea cups", "other trays"],
      },
    },
    boxes: [box(149, 149, 1461, 1465, 0.988)],
    mode: "single",
    reason: "One item.",
    colors: [],
    status: "needs_review",
    en: {
      title: "Colorful Peacock Painted Round Decorative Tray",
      short_description:
        "Round tray with twin peacock and floral art in bright colors. Great for serving and home decor.",
      description:
        "Round decorative tray with twin peacock design surrounded by bright flowers, leaves and paisley details.\nCream base with vibrant blue, green, pink and yellow artwork and colorful border - see photos for detail.\nUse as a serving tray for dry items, table centerpiece, or wall decor.\nWipe with a dry soft cloth and keep away from excess water. Please check size from seller before ordering.\nPerfect for lovers of traditional, festive and colorful home decor.",
      category: "Home decor",
      attributes: [
        { name: "Shape", value: "Round with raised rim" },
        { name: "Base Color", value: "Off-white / cream" },
        { name: "Design", value: "Twin peacock with floral pattern" },
        { name: "Color", value: "Multicolor - blue, green, pink, yellow" },
      ],
      tags: [
        "peacock tray",
        "decorative tray",
        "painted tray",
        "serving tray",
        "home decor",
        "floral tray",
        "traditional decor",
        "gift item",
      ],
      price_hint_bdt: {
        low: 750,
        high: 1650,
        basis: "Decorative painted trays with traditional art are common gifts.",
      },
      confidence: 0.78,
      check_notes: [
        "Check tray material - metal, tin or papier-mache",
        "Measure diameter and height for size info",
        "Check if suitable for food serving or decor only",
        "Check care - wipe clean or washable",
      ],
    },
    bn: {
      title: "রঙিন ময়ূর আঁকা গোল সাজানো ট্রে",
      short_description: "জোড়া ময়ূর আর ফুলের নকশা করা উজ্জ্বল রঙের গোল ট্রে। পরিবেশন ও ঘর সাজানোর জন্য দারুণ।",
      description:
        "জোড়া ময়ূরের নকশা করা গোল সাজানো ট্রে, চারপাশে উজ্জ্বল ফুল, পাতা ও কলকার নকশা।\nক্রিম বেসের ওপর প্রাণবন্ত নীল, সবুজ, গোলাপি ও হলুদ রঙের কাজ আর রঙিন পাড় — বিস্তারিত দেখতে ছবি দেখুন।\nশুকনো খাবার পরিবেশন, টেবিলের মাঝখানে সাজানো কিংবা দেয়াল সাজানোর জন্য ব্যবহার করতে পারবেন।\nশুকনো নরম কাপড় দিয়ে মুছে নিন আর বেশি পানি থেকে দূরে রাখুন। অর্ডারের আগে সাইজ বিক্রেতার কাছ থেকে জেনে নিন।\nঐতিহ্যবাহী, উৎসবমুখর ও রঙিন ঘর সাজানো যারা ভালোবাসেন তাদের জন্য একদম পারফেক্ট।",
      attributes: [
        { name: "আকৃতি", value: "গোলাকার উঁচু কানা সহ" },
        { name: "বেস রং", value: "অফ হোয়াইট ও ক্রিম" },
        { name: "নকশা", value: "জোড়া ময়ূর ও ফুলের নকশা" },
        { name: "রং", value: "বহুরঙা — নীল, সবুজ, গোলাপি, হলুদ" },
      ],
      tags: [
        "ময়ূর ট্রে",
        "সাজানো ট্রে",
        "রঙিন ট্রে",
        "ফুলের ট্রে",
        "ঘর সাজানো",
        "peacock tray",
        "home decor",
        "serving tray",
      ],
      check_notes: [
        "ট্রের ম্যাটেরিয়াল দেখুন — ধাতব, টিন নাকি পেপার মাশা",
        "সাইজের তথ্যের জন্য ব্যাস ও উচ্চতা মেপে নিন",
        "খাবার পরিবেশনের জন্য উপযোগী নাকি শুধু সাজানোর জন্য তা দেখুন",
        "যত্নের নিয়ম দেখুন — শুকনো মুছে নেওয়া যাবে নাকি ধোয়া যাবে",
      ],
    },
  },
  {
    key: "saree",
    plan: {
      sam_phrase: "jamdani saree",
      alt_phrases: ["red saree", "folded saree"],
      contents_phrases: [],
      category_guess: "Sarees",
      likely_multi: false,
      item_count_guess: 1,
      multi_kind: "single",
      camera_angle: "top_down",
      photo_notes: "Overhead shot in natural light with heavy desk clutter around the fabric.",
      scene_brief: {
        setting: "draped over the arm of a carved wooden chair by a sunlit window",
        palette: ["cream", "warm wood", "soft green"],
        avoid: ["a matching blouse", "jewellery"],
      },
    },
    boxes: [box(171, 57, 1092, 1011, 0.808)],
    mode: "single",
    reason: "One item.",
    colors: [],
    status: "ready",
    en: {
      title: "Red Jamdani Saree with Gold Zari Work",
      short_description: "Classic red Jamdani saree with gold floral butis and rich woven border for festive wear.",
      description:
        "Gorgeous red Jamdani-style saree with all-over gold floral butis and wide woven border, as shown in photos.\nFestive traditional look that pairs beautifully with gold jewellery. See photos for detail on design and colour.\nStandard saree drape for adult wear, suitable for Eid, Puja, weddings and dawat occasions.\nCare with dry clean only and store folded in a cool, dry place to keep the woven work fresh.",
      category: "Sarees",
      attributes: [
        { name: "Color", value: "Red with gold" },
        { name: "Work", value: "Gold-toned woven zari buti" },
        { name: "Border", value: "Wide woven traditional border" },
        { name: "Type", value: "Jamdani saree" },
      ],
      tags: ["jamdani saree", "red saree", "gold zari saree", "festive saree", "wedding saree", "deshi saree"],
      price_hint_bdt: {
        low: 2800,
        high: 6500,
        basis: "Red zari jamdani-style festive sarees often listed in this range",
      },
      confidence: 0.75,
      check_notes: [
        "Check fabric composition: half-silk, cotton or other - not visible in photo",
        "Confirm if blouse piece is included and its length",
        "Confirm saree length and whether pure Jamdani or Jamdani-style weave",
      ],
    },
    bn: {
      title: "সোনালি জরির কাজের লাল জামদানি শাড়ি",
      short_description: "উৎসবের জন্য লাল জামদানি শাড়ি, সোনালি ফুলেল বুটি আর চওড়া বোনা পাড়।",
      description:
        "লাল জমিনে সোনালি ফুলেল বুটি আর চওড়া বোনা পাড়ের জামদানি শাড়ি। নকশার খুঁটিনাটি ছবিতে দেখুন।\nসোনার গয়নার সঙ্গে দারুণ মানায়।\nঈদ, পূজা, বিয়ে আর দাওয়াতের জন্য উপযুক্ত।\nশুধু ড্রাই ক্লিন করুন, ভাঁজ করে ঠান্ডা ও শুকনো জায়গায় রাখুন।",
      attributes: [
        { name: "রং", value: "সোনালির সঙ্গে লাল" },
        { name: "কাজ", value: "সোনালি জরির বুটি" },
        { name: "পাড়", value: "চওড়া বোনা পাড়" },
        { name: "ধরন", value: "জামদানি শাড়ি" },
      ],
      tags: ["জামদানি শাড়ি", "লাল শাড়ি", "জরির শাড়ি", "উৎসবের শাড়ি", "jamdani saree"],
      check_notes: [
        "কাপড়টা দেখে নিন: হাফ-সিল্ক, কটন না অন্য কিছু, ছবিতে বোঝা যাচ্ছে না",
        "ব্লাউজ পিস আছে কি না আর তার মাপ নিশ্চিত করুন",
        "শাড়ির দৈর্ঘ্য আর খাঁটি জামদানি নাকি জামদানি-ধাঁচের বুনন, নিশ্চিত করুন",
      ],
    },
  },
];
