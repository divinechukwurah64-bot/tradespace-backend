'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Briefcase, Star, Plus, CheckCircle, Users, Zap } from 'lucide-react';
import API from '@/lib/api';

export default function ClearSpace() {
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGigs();
  }, []);

  const fetchGigs = async () => {
    try {
      setLoading(true);
      const response = await API.get('/gigs');
      setGigs(response.data);
    } catch (err) {
      setError('Failed to load gigs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
     {/* Hero Banner */}
<div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12 md:py-20 relative overflow-hidden">
  <div 
    className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-30"
    style={{
      backgroundImage: `url('https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop')`
    }}
  ></div>
  
  <div className="max-w-7xl mx-auto px-4 relative z-10">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
      <div>
        <h1 className="text-3xl md:text-5xl font-bold mb-4">Clear Space</h1>
        <p className="text-base md:text-xl text-purple-100 mb-8 max-w-2xl">
          Buy and sell services. Hire experts for your projects or offer your skills to thousands of clients.
        </p>
        <Link href="/create-gig" className="inline-block bg-white text-purple-600 px-6 md:px-8 py-2 md:py-3 rounded-full font-bold hover:bg-gray-100">
          Post Your First Gig
        </Link>
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
              <p className="text-gray-600 text-sm">Describe what you offer, set your price, and start receiving orders from clients worldwide.</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-black mb-2 text-lg">Connect with Clients</h3>
              <p className="text-gray-600 text-sm">Chat directly with buyers, discuss requirements, and deliver exactly what they need.</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-black mb-2 text-lg">Get Paid Securely</h3>
              <p className="text-gray-600 text-sm">We hold payment until you deliver. Fast, secure, and reliable transactions.</p>
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
                <p className="text-gray-600 text-sm">Money is held in escrow until the buyer approves the work.</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Build Your Reputation</h3>
                <p className="text-gray-600 text-sm">Earn 5-star ratings and build a portfolio of happy clients.</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Direct Communication</h3>
                <p className="text-gray-600 text-sm">Chat with clients and clarify all details before starting work.</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-black mb-2">Flexible Pricing</h3>
                <p className="text-gray-600 text-sm">Set your own rates and choose projects that interest you.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gigs Section */}
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-black">Available Gigs</h2>
            <p className="text-gray-600 text-sm mt-1">Browse services from talented professionals</p>
          </div>
          <Link href="/create-gig" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm md:text-base font-medium">
            <Plus className="w-4 h-4" />
            Post a Gig
          </Link>
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
            <Link href="/create-gig" className="inline-block bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm">
              Post First Gig
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gigs.map((gig) => (
              <a key={gig._id} href={`/clear-space/${gig._id}`} className="block">
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition cursor-pointer h-full">
                  
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-24 flex items-center justify-center">
                    <Briefcase className="w-12 h-12 text-white" />
                  </div>

                  <div className="p-6">
                    
                    <h3 className="font-bold text-gray-900 line-clamp-2 text-lg mb-2">
                      {gig.title}
                    </h3>

                    <p className="text-xs text-gray-500 mb-3">{gig.category}</p>

                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                      {gig.description}
                    </p>

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
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}