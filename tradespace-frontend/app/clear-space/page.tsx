'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Star,
  Plus,
  CheckCircle,
  Users,
  Zap,
  ShieldCheck,
  ChevronDown,
  User,
  Mail,
} from 'lucide-react';
import API from '@/lib/api';

const SUPPORT_EMAIL = 'support@tradespace.online';

const FAQS = [
  {
    q: 'How do I buy a service on Clear Space?',
    a: 'Open a gig, review the details and price, then pay through the platform. Your payment is held by TradeSpace until the seller delivers and you approve the work.',
  },
  {
    q: 'Why can I not see the seller contact details?',
    a: 'To protect both sides, the seller contact information is only revealed after you have paid. This stops deals from moving off the platform where neither of you is protected.',
  },
  {
    q: 'When does the seller get paid?',
    a: 'The seller is paid only after the work has been delivered and approved by the buyer. Until then, the money stays with TradeSpace.',
  },
  {
    q: 'What if the seller does not deliver?',
    a: 'If the work is not delivered or does not match the gig, you can reject it and open a dispute. Our team reviews the case and can refund you.',
  },
  {
    q: 'How much does TradeSpace charge?',
    a: 'A commission of 8.5 percent is taken from the seller when a paid order is completed. Buyers do not pay extra fees.',
  },
  {
    q: 'How do I start selling?',
    a: 'Create an account, set up your profile, then post a gig with a clear title, description, price and an image. Orders will appear in your notifications.',
  },
  {
    q: 'How do I get help?',
    a: `Email us at ${SUPPORT_EMAIL} and include your gig or order details so we can help quickly.`,
  },
];

export default function ClearSpace() {
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    fetchGigs();
  }, []);

  const fetchGigs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await API.get('/gigs');
      setGigs(response.data);
    } catch (err) {
      setError('Something went wrong while loading gigs. Please try again later or contact support.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-purple-700 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-pink-500 opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-purple-400 opacity-20 blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-4 py-14 md:py-24 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-xs md:text-sm px-3 py-1 rounded-full mb-5">
                <ShieldCheck className="w-4 h-4" />
                Payments protected by escrow
              </span>
              <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">Clear Space</h1>
              <p className="text-base md:text-xl text-purple-100 mb-8 max-w-xl">
                Hire trusted experts or sell your skills to clients across Nigeria. Your money is
                held safely until the work is delivered.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/create-gig"
                  className="inline-flex items-center justify-center gap-2 bg-white text-purple-700 px-6 md:px-8 py-3 rounded-full font-bold hover:bg-gray-100"
                >
                  <Plus className="w-4 h-4" />
                  Post a Gig
                </Link>
                <a
                  href="#gigs"
                  className="inline-flex items-center justify-center border border-white/40 text-white px-6 md:px-8 py-3 rounded-full font-bold hover:bg-white/10"
                >
                  Browse Gigs
                </a>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 md:p-8">
              <h2 className="font-bold text-lg mb-5">How your payment stays safe</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white text-purple-700 font-bold flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <p className="text-sm text-purple-100">
                    The buyer pays. TradeSpace holds the money and the seller is told right away.
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white text-purple-700 font-bold flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <p className="text-sm text-purple-100">
                    The seller contact details are revealed and the work begins.
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white text-purple-700 font-bold flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <p className="text-sm text-purple-100">
                    The seller delivers, the buyer approves, and then the seller is paid.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-black mb-2 text-lg">Post a Service</h3>
              <p className="text-gray-600 text-sm">
                Describe what you offer, add an image, set your price, and start receiving orders.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-black mb-2 text-lg">Connect with Clients</h3>
              <p className="text-gray-600 text-sm">
                Once a buyer has paid, their order is confirmed and you can discuss requirements and deliver.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-black mb-2 text-lg">Get Paid Securely</h3>
              <p className="text-gray-600 text-sm">
                We hold the payment until you deliver. Fast, secure, and reliable transactions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-8">Why Choose Clear Space?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200 flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Secure Payments</h3>
                <p className="text-gray-600 text-sm">
                  Money is held in escrow until the buyer approves the work.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Build Your Reputation</h3>
                <p className="text-gray-600 text-sm">
                  Earn 5-star ratings and build a portfolio of happy clients.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Protected Contact Details</h3>
                <p className="text-gray-600 text-sm">
                  Seller contact details are only revealed after payment, so every deal stays protected.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Flexible Pricing</h3>
                <p className="text-gray-600 text-sm">
                  Set your own rates and choose projects that interest you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gigs Section */}
      <div id="gigs" className="max-w-7xl mx-auto px-4 py-12 md:py-16">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-black">Available Gigs</h2>
            <p className="text-gray-600 text-sm mt-1">Browse services from talented professionals</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href="/profile"
              className="flex items-center justify-center gap-2 border border-purple-600 text-purple-600 px-6 py-2 rounded-lg hover:bg-purple-50 text-sm md:text-base font-medium"
            >
              <User className="w-4 h-4" />
              My Clear Space Profile
            </Link>
            <Link
              href="/create-gig"
              className="flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm md:text-base font-medium"
            >
              <Plus className="w-4 h-4" />
              Post a Gig
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="text-gray-600 mt-4">Loading gigs...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4 text-sm md:text-base">No gigs available yet</p>
            <Link
              href="/create-gig"
              className="inline-block bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm"
            >
              Post First Gig
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gigs.map((gig) => {
              const image = Array.isArray(gig.images) && gig.images.length > 0 ? gig.images[0] : null;
              return (
                <Link key={gig._id} href={`/clear-space/${gig._id}`} className="block">
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition cursor-pointer h-full">
                    {image ? (
                      <img
                        src={image}
                        alt={gig.title}
                        className="w-full h-44 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-44 flex items-center justify-center">
                        <Briefcase className="w-12 h-12 text-white" />
                      </div>
                    )}

                    <div className="p-6">
                      <h3 className="font-bold text-gray-900 line-clamp-2 text-lg mb-2">
                        {gig.title}
                      </h3>

                      <p className="text-xs text-gray-500 mb-3">{gig.category}</p>

                      <p className="text-gray-600 text-sm line-clamp-2 mb-4">{gig.description}</p>

                      <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
                        <div className="w-6 h-6 bg-purple-300 rounded-full"></div>
                        <span>{gig.sellerId?.fullName || 'Unknown'}</span>
                      </div>

                      <div className="flex justify-between items-end pt-4 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500">From</p>
                          <p className="text-2xl font-bold text-black">
                            ₦{gig.startingPrice?.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 mb-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-bold text-black">{gig.rating || 5}</span>
                          </div>
                          <p className="text-xs text-gray-600">{gig.orders || 0} orders</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.q} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 bg-white hover:bg-gray-50"
                  >
                    <span className="font-semibold text-black text-sm md:text-base">{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-purple-600 flex-shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-gray-600 text-sm bg-white">{item.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <h3 className="text-white font-bold text-xl mb-3">Clear Space</h3>
              <p className="text-sm text-gray-400 max-w-md">
                The service marketplace by TradeSpace. Buy and sell services with payments held
                safely until the work is delivered.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-3">Explore</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/clear-space" className="hover:text-white">
                    Browse Gigs
                  </Link>
                </li>
                <li>
                  <Link href="/create-gig" className="hover:text-white">
                    Post a Gig
                  </Link>
                </li>
                <li>
                  <Link href="/profile" className="hover:text-white">
                    My Profile
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/terms" className="hover:text-white">
                    Terms and Conditions
                  </Link>
                </li>
                <li>
                  <a href="#gigs" className="hover:text-white">
                    Available Gigs
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="inline-flex items-center gap-2 hover:text-white"
                  >
                    <Mail className="w-4 h-4" />
                    {SUPPORT_EMAIL}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-10 pt-6 text-xs text-gray-500 text-center">
            &copy; {new Date().getFullYear()} TradeSpace. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}