/*
 * Landing-page content, carried over from the original landing sections
 * (hero, stats, marketplace, how-it-works, AI concierge, trust, CTA, footer).
 */

export const HERO_IMAGE =
  "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1800&fit=crop&auto=format&q=80";

export const NAV_LINKS = [
  { label: "Marketplace", href: "#marketplace" },
  { label: "AI Concierge", href: "#ai-concierge" },
  { label: "How it Works", href: "#how-it-works" },
];

export const HERO_AVATARS = ["JM", "RB", "IH", "FH"];

export const STATS = [
  { value: 35, prefix: "", suffix: "+", label: "Resources listed" },
  { value: 200, prefix: "", suffix: "+", label: "Businesses onboard" },
  { value: 48, prefix: "₹", suffix: "L+", label: "Saved monthly" },
  { value: 0, prefix: "", suffix: "", label: "Double bookings" },
];

export type CategoryId = "banquet" | "kitchen" | "av" | "furniture" | "vehicles" | "event";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "banquet", label: "Banquet Halls" },
  { id: "kitchen", label: "Commercial Kitchens" },
  { id: "av", label: "AV Equipment" },
  { id: "furniture", label: "Furniture & Fixtures" },
  { id: "vehicles", label: "Vehicles & Transport" },
  { id: "event", label: "Event Spaces" },
];

export interface Listing {
  id: number;
  category: CategoryId;
  tag: string;
  title: string;
  business: string;
  location: string;
  description?: string;
  price: string;
  unit: string;
  capacity: string;
  rating: number;
  reviews: number;
  available: boolean;
  availableLabel: string;
}

export const LISTINGS: Listing[] = [
  {
    id: 1, category: "banquet", tag: "Banquet Hall", title: "Grand Ballroom", business: "JW Marriott Pune",
    location: "Koregaon Park, Pune",
    description: "Opulent 10,000 sq.ft space with crystal chandeliers and AV setup included.",
    price: "₹45,000", unit: "/day", capacity: "500 pax", rating: 4.9, reviews: 38,
    available: true, availableLabel: "Available Sat–Sun",
  },
  {
    id: 2, category: "kitchen", tag: "Commercial Kitchen", title: "Industrial Production Kitchen", business: "Radisson Blu Pune",
    location: "Bund Garden Road, Pune",
    description: "Rational iCombi Pro 20-Grid Oven, prep stations, walk-in cold storage.",
    price: "₹8,500", unit: "/half-day", capacity: "12 staff", rating: 4.7, reviews: 24,
    available: true, availableLabel: "Available weekdays",
  },
  {
    id: 3, category: "av", tag: "AV Equipment", title: "Full AV Conference Bundle", business: "Fortune Hotels India",
    location: "Viman Nagar, Pune",
    description: "4K projector, 75\" smart displays ×4, wireless mics, Dolby sound system.",
    price: "₹12,000", unit: "/day", capacity: "200 pax", rating: 4.8, reviews: 17,
    available: false, availableLabel: "Next available Mon",
  },
  {
    id: 4, category: "event", tag: "Event Space", title: "Rooftop Terrace — 5,000 sq.ft", business: "Hyatt Regency Pune",
    location: "Nagar Road, Pune",
    price: "₹28,000", unit: "/day", capacity: "350 pax", rating: 4.9, reviews: 29,
    available: true, availableLabel: "Available",
  },
  {
    id: 5, category: "furniture", tag: "Furniture & Fixtures", title: "Premium Chair & Table Set ×200", business: "ITC Maratha Mumbai",
    location: "Andheri East, Mumbai",
    price: "₹6,000", unit: "/day", capacity: "200 pax", rating: 4.6, reviews: 41,
    available: true, availableLabel: "Available",
  },
  {
    id: 6, category: "vehicles", tag: "Vehicle Fleet", title: "Luxury Coach Fleet ×4 Buses", business: "Sahara Star Mumbai",
    location: "Santacruz, Mumbai",
    price: "₹22,000", unit: "/day", capacity: "160 seats", rating: 4.5, reviews: 12,
    available: false, availableLabel: "Fri onwards",
  },
];

export const STEPS = [
  {
    number: "01", icon: "search" as const, title: "Post or Browse",
    description: "List idle resources or search what you need from verified hospitality businesses across Pune & Mumbai.",
  },
  {
    number: "02", icon: "sparkles" as const, title: "Get AI Matched",
    description: "Our concierge analyses availability, capacity, and budget to surface the best matches in seconds.",
  },
  {
    number: "03", icon: "calendar" as const, title: "Book & Coordinate",
    description: "Instant booking with conflict-free calendar sync, escrow payment protection, and real-time tools.",
  },
];

export const GUARANTEES = [
  "Zero double-booking with atomic calendar locks",
  "AI concierge finds best matches in under 2 seconds",
  "Escrow-protected payments — funds released on completion",
  "Real-time notifications for every booking event",
  "GST-compliant invoicing generated automatically",
  "Verified business profiles with trust scores",
];

export const CONCIERGE_FEATURES = [
  { icon: "zap" as const, title: "Instant Matching", desc: "AI surfaces the 3 best vendor matches in under 2 minutes." },
  { icon: "clock" as const, title: "24/7 Availability", desc: "Concierge works round-the-clock, even outside business hours." },
  { icon: "shield" as const, title: "Conflict-Free Booking", desc: "Real-time calendar sync eliminates double bookings completely." },
];

export const PARTNERS = [
  { name: "ITC Hotels" },
  { name: "Radisson Blu" },
  { name: "Sarovar Hotels" },
  { name: "Fortune Hotels" },
  { name: "The Westin" },
  { name: "Hyatt Pune" },
];

export const TESTIMONIALS = [
  {
    headline: "Three Matching Vendors in Under Two Minutes.",
    quote:
      "The HostNexus AI found us 3 matching vendors in under 2 minutes. We booked a 500-pax banquet setup from Sarovar Hotels, and the whole process — from search to confirmation — took less than 10 minutes.",
    name: "Rajesh Kumar", title: "Operations Manager", company: "Radisson Blu Pune", initial: "RK", rating: 5,
  },
  {
    headline: "Our Idle Kitchen Is Now Booked 80% of the Time.",
    quote:
      "We used to have our industrial kitchen idle for 3 days a week. Since listing on HostNexus, it's booked 80% of the time. The platform paid for itself within the first week.",
    name: "Priya Nair", title: "F&B Director", company: "ITC Maratha Mumbai", initial: "PN", rating: 5,
  },
];

export const FOOTER_LINKS: Record<string, { label: string; href: string }[]> = {
  Platform: [
    { label: "Marketplace", href: "#marketplace" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "AI Concierge", href: "#ai-concierge" },
  ],
  Account: [
    { label: "Sign In", href: "/login" },
    { label: "List a Resource", href: "/register" },
    { label: "Business Dashboard", href: "/dashboard" },
  ],
};
