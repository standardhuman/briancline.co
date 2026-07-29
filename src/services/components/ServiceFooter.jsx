import React from "react";
import { Link } from "react-router-dom";

export default function ServiceFooter() {
  return (
    <footer className="bg-[#0a1628] text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div>
            <Link to="/marine" className="inline-flex items-baseline gap-2 text-xl font-bold" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              briancline<span className="text-[#00bcd4]">.</span>co
              <span className="text-xs font-semibold tracking-wide uppercase text-[#d4a85c]">vessel management</span>
            </Link>
            <p className="mt-3 text-gray-400 text-sm leading-relaxed">
              Vessel management on San Francisco Bay. Hull cleaning, detailing, sailing instruction, and vessel deliveries — one point of contact for everything your boat needs.
            </p>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-400 mb-4">Services</h3>
            <ul className="space-y-2.5">
              <li><Link to="/hull-cleaning" className="text-gray-300 hover:text-white text-sm transition-colors">Hull Cleaning</Link></li>
              <li><Link to="/boat-detailing" className="text-gray-300 hover:text-white text-sm transition-colors">Boat Detailing</Link></li>
              <li><Link to="/sailing-lessons" className="text-gray-300 hover:text-white text-sm transition-colors">Sailing Lessons</Link></li>
              <li><Link to="/deliveries" className="text-gray-300 hover:text-white text-sm transition-colors">Vessel Deliveries</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-400 mb-4">Get in Touch</h3>
            <ul className="space-y-2.5">
              <li>
                <a href="mailto:brian@briancline.co" className="text-gray-300 hover:text-white text-sm transition-colors">
                  brian@briancline.co
                </a>
              </li>

              <li>
                <a href="/" className="text-gray-300 hover:text-white text-sm transition-colors">
                  briancline.co
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} Brian Cline. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <li>
              <Link to="/terms" className="text-gray-500 hover:text-gray-300 transition-colors">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to="/recurring-authorization" className="text-gray-500 hover:text-gray-300 transition-colors">
                Recurring Authorization
              </Link>
            </li>
          </ul>
          <p className="text-gray-500 text-xs">
            Former Ferry Captain · US Sailing Cruising Instructor
          </p>
        </div>
      </div>
    </footer>
  );
}
