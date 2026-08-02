'use client';

import Link from 'next/link';
import { Gavel, ShoppingCart, Lock, Star, MessageSquare, TrendingUp, ArrowRight, CheckCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-12 md:py-24 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-20"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop')`
          }}
        ></div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold mb-4">TradeSpace</h1>
              <p className="text-base md:text-xl text-gray-300 mb-4 max-w-2xl">
                Bid. Buy. Sell. Confidently.
              </p>
              <p className="text-base md:text-lg text-gray-400 mb-8 max-w-2xl">
                Your money is safe. We hold payments until you're satisfied with your order.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auctions" className="inline-block bg-blue-600 text-white px-6 md:px-8 py-2 md:py-3 rounded-full font-bold hover:bg-blue-700 text-center">
                  Start Bidding
                </Link>
                <Link href="/clear-space" className="inline-block border-2 border-white text-white px-6 md:px-8 py-2 md:py-3 rounded-full font-bold hover:bg-gray-700 text-center">
                  Sell Services
                </Link>
              </div>
            </div>
            
          
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-8">Why TradeSpace?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Buyer Protection</h3>
                <p className="text-gray-600 text-sm">Your payment is secure. We hold it until you confirm delivery and inspect the item.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Real-Time Bidding</h3>
                <p className="text-gray-600 text-sm">Live auctions with instant updates. Compete fairly with transparent bidding history.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Verified Sellers</h3>
                <p className="text-gray-600 text-sm">Buy from trusted sellers. Every review is verified and backed by real transactions.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Direct Messaging</h3>
                <p className="text-gray-600 text-sm">Chat with buyers and sellers. Negotiate and close deals faster.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Sell Your Skills</h3>
                <p className="text-gray-600 text-sm">Offer services on Clear Space. Get paid securely for gigs and freelance work.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Build Your Reputation</h3>
                <p className="text-gray-600 text-sm">Earn 5-star ratings. Access tools to scale your buying or selling.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Section */}
      <div className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-black">Live Auctions</h3>
              <p className="text-gray-600 text-sm">Trending items ending soon</p>
            </div>
            <Link href="/auctions" className="hidden md:flex items-center gap-1 text-blue-600 font-bold hover:text-blue-700 text-sm">
              See all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition bg-white">
                <div className="bg-gray-100 h-40 sm:h-48 flex items-center justify-center">
                  <ShoppingCart className="w-12 h-12 text-gray-400" />
                </div>
                <div className="p-4">
                  <p className="text-sm font-bold text-gray-900">Premium Item</p>
                  <p className="text-xs text-gray-500 mt-1">Ends in 2 hours</p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-lg font-bold text-black">₦5,450</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">12 bids</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8 md:hidden">
            <Link href="/auctions" className="inline-block text-blue-600 font-bold hover:text-blue-700">
              See all auctions →
            </Link>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h3 className="text-2xl md:text-4xl font-bold mb-4">Ready to Start Trading?</h3>
          <p className="text-base md:text-lg text-blue-100 mb-8">Join Nigeria's fastest growing marketplace</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-white text-blue-600 px-6 md:px-8 py-2 md:py-3 rounded-full font-bold hover:bg-gray-100 text-center">
              Create Account
            </Link>
            <Link href="/auctions" className="border-2 border-white text-white px-6 md:px-8 py-2 md:py-3 rounded-full font-bold hover:bg-blue-700 text-center">
              Browse Now
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>&copy; 2026 TradeSpace. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}