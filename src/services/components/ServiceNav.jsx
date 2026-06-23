import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { Anchor, Ship, GraduationCap, Sparkles } from "lucide-react";

const navLinks = [
  { to: "/hull-cleaning", label: "Hull Cleaning", icon: Anchor },
  { to: "/boat-detailing", label: "Boat Detailing", icon: Sparkles },
  { to: "/sailing-lessons", label: "Sailing Lessons", icon: GraduationCap },
  { to: "/deliveries", label: "Deliveries", icon: Ship },
];

export default function ServiceNav() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo — clicks to /marine */}
        <Link to="/marine" className="flex items-baseline gap-1.5 text-lg font-bold text-[#0a1628]" style={{ letterSpacing: "-0.02em", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          <span className="md:hidden">bc<span style={{ color: "#00bcd4", fontSize: "1.4em", lineHeight: 0, position: "relative", top: "0.05em" }}>.</span></span>
          <span className="hidden md:inline">briancline<span style={{ color: "#00bcd4" }}>.</span>co</span>
          <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "#7a5a22" }}>vessel management</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#b8863b]/10 text-[#7a5a22]"
                    : "text-gray-600 hover:text-[#0a1628] hover:bg-gray-50"
                )}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* CTA + Mobile toggle */}
        <div className="flex items-center gap-3">
          <a
            href="mailto:brian@briancline.co?subject=Vessel%20Management%20Inquiry"
            className="hidden sm:inline-flex px-4 py-2 text-white rounded-lg text-sm font-semibold transition-all hover:brightness-105"
            style={{ background: "linear-gradient(135deg,#c2933f,#8a6526)", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
          >
            Contact
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-50"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#b8863b]/10 text-[#7a5a22]"
                    : "text-gray-600 hover:text-[#0a1628] hover:bg-gray-50"
                )}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
          <a
            href="mailto:brian@briancline.co?subject=Vessel%20Management%20Inquiry"
            className="block px-3 py-2.5 text-sm font-semibold text-[#7a5a22]"
          >
            Contact Brian
          </a>
        </div>
      )}
    </nav>
  );
}
