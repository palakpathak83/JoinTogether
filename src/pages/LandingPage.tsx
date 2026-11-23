import { ArrowRight, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { EditorialImage } from '../components/EditorialImage.tsx';
import { Navbar } from '../components/Navbar.tsx';
import { useAuth } from '../context/AuthContext.tsx';

const HERO_IMG = '/src/assets/images/hero_community_collab_1795364397399.jpg';
const SHOPPING_IMG = '/src/assets/images/category_shopping_split_1795364396700.jpg';
const TRAVEL_IMG = '/src/assets/images/category_travel_group_1795364397185.jpg';
const HACKATHON_IMG = '/src/assets/images/category_hackathon_team_1795364397166.jpg';
const EVENTS_IMG = '/src/assets/images/category_events_venue_1795364396464.jpg';

export default function LandingPage() {
  const { user, health } = useAuth();
  const dbDisconnected = health && health.database.state !== 'connected';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      {dbDisconnected && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-center text-xs font-medium text-amber-900">
          Database notice: MONGODB_URI is not connected ({health.database.state}). Configure MONGODB_URI in environment settings to enable sign-in and persistence.
        </div>
      )}

      <main>
        {/* Hero Split */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col justify-between lg:col-span-6"
              >
                <div>
                  <p className="text-xs font-medium tracking-wide text-blue-700">
                    Structured Group Coordination
                  </p>
                  <h1 className="mt-4 font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-slate-900 text-balance">
                    Find verified partners for shared orders, routes, teams, and events.
                  </h1>
                  <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600">
                    JoinTogether replaces fragmented group chats with category-specific compatibility scoring,
                    capacity-enforced squads, and authenticated real-time coordination rooms.
                  </p>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Link
                    to={user ? '/app' : '/register'}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{user ? 'Go to Workspace' : 'Create Free Account'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to={user ? '/app/matches' : '/login'}
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {user ? 'Browse Matches' : 'Sign In'}
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-6"
              >
                <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <EditorialImage
                    src={HERO_IMG}
                    alt="Peers collaborating around a studio table with laptops and route plans"
                    category="hackathon"
                    className="h-72 w-full object-cover lg:h-full lg:min-h-[400px]"
                  />
                </div>
              </motion.div>
            </div>

            {/* Full-width 4-column summary strip below hero */}
            <div className="mt-14 grid grid-cols-2 gap-6 border-t border-slate-200 pt-8 md:grid-cols-4">
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">4</p>
                <p className="mt-1 text-sm text-slate-600">Dedicated matching engines</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">0–100</p>
                <p className="mt-1 text-sm text-slate-600">Explainable compatibility score</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">Atomic</p>
                <p className="mt-1 text-sm text-slate-600">Race-safe group seat caps</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">Live</p>
                <p className="mt-1 text-sm text-slate-600">Authenticated Socket.IO rooms</p>
              </div>
            </div>
          </div>
        </section>

        {/* Category Bento Showcase */}
        <section id="categories" className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
              01. Four Purpose-Built Matching Categories
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Each category enforces strict hard compatibility filters before scoring candidates, so irrelevant requests never clutter your feed.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Marquee card col-span-2 */}
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 md:items-stretch">
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 md:aspect-auto">
                  <EditorialImage
                    src={HACKATHON_IMG}
                    alt="Engineers and designers mapping architecture on a glass whiteboard"
                    category="hackathon"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-between p-6">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Hackathons · Role Complementarity · Stack Fit
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-slate-900">
                      Hackathon Team Formation
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      Match builders by hackathon event, attendance format, and reciprocal role demand. Backend engineers automatically pair with designers or frontend leads who need their exact skill set.
                    </p>
                  </div>
                  <ul className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-700">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                      <span>Hard filter on event alignment and format compatibility</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                      <span>Weighted scoring for mutual role fit and shared tech stack</span>
                    </li>
                  </ul>
                </div>
              </div>
            </article>

            {/* Shopping card */}
            <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <EditorialImage
                  src={SHOPPING_IMG}
                  alt="Curated coffee bags, ceramics, and audio hardware on travertine stone"
                  category="shopping"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Shopping · Threshold Split · Zone Match
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-slate-900">
                    Group Buying & Order Splits
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Pool local orders to clear free-shipping minimums or wholesale tiers across shared delivery zones.
                  </p>
                </div>
              </div>
            </article>

            {/* Travel card */}
            <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <EditorialImage
                  src={TRAVEL_IMG}
                  alt="Electric SUV parked at a sunlit coastal overlook"
                  category="travel"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Travel · Date Window · Budget Ceiling
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-slate-900">
                    Shared Routes & Carpools
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Coordinate departure windows, destination hubs, transport modes, and itinerary pace with vetted peers.
                  </p>
                </div>
              </div>
            </article>

            {/* Events card col-span-2 */}
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 md:items-stretch">
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 md:aspect-auto">
                  <EditorialImage
                    src={EVENTS_IMG}
                    alt="Attendees conversing in a sunlit conference atrium"
                    category="event"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-between p-6">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Events · Venue Sync · Ticket Tier
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-slate-900">
                      Conferences, Workshops & Live Events
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      Organize group passes, split multi-seat discounts, and align on attendance style before arriving at the venue.
                    </p>
                  </div>
                  <ul className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-700">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                      <span>Same-city and 24-hour schedule validation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                      <span>Automatic exclusion of expired or closed listings</span>
                    </li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Mechanism & Workflow */}
        <section id="matching" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
                  02. Explainable Matching, Not Black-Box Feeds
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Every candidate pair receives a deterministic compatibility breakdown showing exactly which rules matched and why. Administrators can tune category weights directly without redeploying.
                </p>
              </div>

              <div className="lg:col-span-7">
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                  <div className="py-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-display text-base font-semibold text-slate-900">
                        Hard Compatibility Gate
                      </h3>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">Step 1</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">
                      Filters out expired requests, self-matches, already-joined groups, incompatible delivery zones, mismatched dates, or non-complementary hackathon roles.
                    </p>
                  </div>

                  <div className="py-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-display text-base font-semibold text-slate-900">
                        Configurable Weighted Score
                      </h3>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">Step 2</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">
                      Computes a clamped 0–100 score using category-specific weights stored in MongoDB and returns concrete match reasons alongside paginated results.
                    </p>
                  </div>

                  <div className="py-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-display text-base font-semibold text-slate-900">
                        Atomic Capacity & Verified Chat
                      </h3>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">Step 3</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">
                      Accepting a join request executes an atomic database capacity check so groups never exceed their seat limit. Only verified members can enter the Socket.IO room.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Conversion Band */}
        <section id="workflow" className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col justify-between gap-8 rounded-xl border border-slate-200 bg-white p-8 md:flex-row md:items-center lg:p-12">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                03. Ready to coordinate your next group?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Post a request in under a minute, inspect ranked matches with transparent reasons, and finalize logistics inside a real-time member-only chat room.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to={user ? '/app/requests' : '/register'}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{user ? 'Create Request' : 'Create Account'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p className="font-display font-semibold text-slate-900">JoinTogether</p>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-slate-900">Sign In</Link>
            <Link to="/register" className="hover:text-slate-900">Register</Link>
            <Link to="/app" className="hover:text-slate-900">Workspace</Link>
          </div>
          <p>© {new Date().getFullYear()} JoinTogether</p>
        </div>
      </footer>
    </div>
  );
}
