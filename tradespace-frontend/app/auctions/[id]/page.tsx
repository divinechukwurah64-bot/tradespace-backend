'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, User, ArrowLeft, Heart, Share2, Trash2 } from 'lucide-react';
import API from '@/lib/api';

export default function AuctionDetail() {
  const params = useParams();
  const router = useRouter();
  const auctionId = params.id as string;

  const [auction, setAuction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAuctionData = async () => {
    try {
      const response = await API.get(`/auctions/${auctionId}`);
      setAuction(response.data);
    } catch (err) {
      console.error('Failed to fetch auction');
    }
  };

  const fetchSocial = async () => {
    try {
      const response = await API.get(`/auctions/${auctionId}/social`);
      setLikeCount(response.data.likeCount);
      setLiked(response.data.liked);
      setCommentCount(response.data.commentCount);
      setComments(response.data.comments);
    } catch (err) {
      console.error('Failed to fetch likes and comments');
    }
  };

  useEffect(() => {
    const fetchAuction = async () => {
      try {
        const response = await API.get(`/auctions/${auctionId}`);
        setAuction(response.data);
      } catch (err) {
        setError('Failed to load auction');
      } finally {
        setLoading(false);
      }
    };

    const fetchUser = async () => {
      try {
        const response = await API.get('/auth/me');
        setCurrentUser(response.data);
      } catch (err) {
        console.log('Not logged in');
      }
    };

    fetchAuction();
    fetchUser();
    fetchSocial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  useEffect(() => {
    if (!auction?.endsAt) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(auction.endsAt);
      const diff = end.getTime() - now.getTime();

      if (diff < 0) {
        setTimeLeft('Auction Ended');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  // Refresh every 5 seconds so new bids, comments and the live banner show up
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAuctionData();
      fetchSocial();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  const handlePlaceBid = async (e: any) => {
    e.preventDefault();
    setBidError('');
    setBidLoading(true);

    if (!currentUser) {
      setBidError('Please log in to place a bid');
      setBidLoading(false);
      return;
    }

    try {
      await API.post(`/auctions/${auctionId}/bids`, {
        amount: Number(bidAmount),
      });
      setBidAmount('');
      await fetchAuctionData();
    } catch (err: any) {
      setBidError(err.response?.data?.error || 'Failed to place bid');
    } finally {
      setBidLoading(false);
    }
  };

  const handleDeleteAuction = async () => {
    if (!window.confirm('Are you sure you want to delete this auction?')) return;

    try {
      await API.delete(`/auctions/${auctionId}`);
      router.push('/auctions');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete auction');
    }
  };

  const handleLike = async () => {
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }
    try {
      const response = await API.post(`/auctions/${auctionId}/like`);
      setLiked(response.data.liked);
      setLikeCount(response.data.likeCount);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not update your like');
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Could not copy the link');
    }
  };

  const handlePostComment = async (e: any) => {
    e.preventDefault();
    setCommentError('');

    const text = commentText.trim();
    if (!text) return;

    setPosting(true);
    try {
      await API.post(`/auctions/${auctionId}/comments`, { content: text });
      setCommentText('');
      await fetchSocial();
    } catch (err: any) {
      setCommentError(err.response?.data?.error || 'Could not post your comment');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await API.delete(`/auctions/${auctionId}/comments/${commentId}`);
      await fetchSocial();
    } catch (err: any) {
      setCommentError(err.response?.data?.error || 'Could not delete the comment');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Auction not found</p>
          <Link href="/auctions" className="text-blue-600 hover:underline">
            Back to Auctions
          </Link>
        </div>
      </div>
    );
  }

  const sellerId = auction?.sellerId?._id;
  const isSellerLoggedIn = !!(currentUser && sellerId && currentUser._id === sellerId);
  const isAdmin = currentUser?.role === 'admin';
  const images = auction.images && auction.images.length > 0
    ? auction.images
    : ['https://via.placeholder.com/500x500?text=No+Image'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/auctions" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-5 h-5" />
            Back to Auctions
          </Link>
          <h1 className="text-3xl font-bold text-black">{auction.title}</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="relative bg-white rounded-lg shadow overflow-hidden mb-4">
              {auction.isLive && (
                <span className="absolute top-3 left-3 z-10 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  LIVE
                </span>
              )}
              <img
                src={images[imageIndex]}
                alt={auction.title}
                className="w-full h-64 md:h-80 object-cover"
              />

              {images.length > 1 && (
                <div className="bg-gray-100 p-4 flex gap-2 overflow-x-auto">
                  {images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setImageIndex(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                        idx === imageIndex ? 'border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Description</h2>
              <p className="text-gray-700 leading-relaxed mb-4">{auction.description}</p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="text-lg font-semibold text-black">{auction.category || 'General'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Condition</p>
                  <p className="text-lg font-semibold text-black">{auction.condition || 'Good'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Seller Information
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {auction.sellerId?.fullName?.[0]?.toUpperCase() || 'S'}
                </div>
                <div>
                  <p className="font-semibold text-black text-lg">{auction.sellerId?.fullName || 'Unknown Seller'}</p>
                  <p className="text-sm text-gray-600">{auction.sellerId?.email || 'No email'}</p>
                  <p className="text-sm text-gray-600">{auction.sellerId?.phone || 'No phone'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-2">Seller Stats</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-black">⭐ 4.8</p>
                    <p className="text-xs text-gray-600">Rating</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-black">127</p>
                    <p className="text-xs text-gray-600">Items Sold</p>
                  </div>
                </div>
              </div>

              <button className="w-full mt-4 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100 transition font-semibold">
                Contact Seller
              </button>
            </div>
          </div>

          <div>
            {auction.isLive && !isSellerLoggedIn && (
              <Link
                href={`/live/${auctionId}`}
                className="block bg-red-600 text-white rounded-lg p-4 mb-6 text-center font-bold hover:bg-red-700 transition"
              >
                LIVE NOW - Watch the stream
              </Link>
            )}

            {isSellerLoggedIn && timeLeft !== 'Auction Ended' && auction.status === 'active' && (
              <Link
                href={`/live/${auctionId}`}
                className="block bg-red-600 text-white rounded-lg p-4 mb-6 text-center font-bold hover:bg-red-700 transition"
              >
                {auction.isLive ? 'You are live - Manage Stream' : 'Go Live'}
              </Link>
            )}

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-700 font-semibold">Time Left</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{timeLeft}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <p className="text-sm text-gray-600 mb-2">Starting Bid</p>
              <p className="text-2xl font-bold text-black mb-4">₦{auction.startingBid?.toLocaleString()}</p>

              {auction.currentBid && (
                <>
                  <p className="text-sm text-gray-600 mb-2">Current Bid</p>
                  <p className="text-3xl font-bold text-blue-600 mb-4">₦{auction.currentBid?.toLocaleString()}</p>
                </>
              )}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Total Bids</p>
                <p className="text-lg font-semibold text-black">{auction.bids?.length || 0} bids</p>
              </div>
            </div>

            {!isSellerLoggedIn && timeLeft !== 'Auction Ended' && (
              <form onSubmit={handlePlaceBid} className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="font-bold text-black mb-4">Place a Bid</h3>
                {bidError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
                    {bidError}
                  </div>
                )}
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Minimum: ₦${(auction.currentBid || auction.startingBid)?.toLocaleString()}`}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={bidLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {bidLoading ? 'Placing Bid...' : 'Place Bid'}
                </button>
              </form>
            )}

            {isSellerLoggedIn && (
              <button
                onClick={handleDeleteAuction}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center justify-center gap-2 mb-6"
              >
                <Trash2 className="w-5 h-5" />
                Delete Auction
              </button>
            )}

            {timeLeft === 'Auction Ended' && (
              <div className="bg-gray-100 rounded-lg p-6 text-center mb-6">
                <p className="text-gray-700 font-semibold">This auction has ended</p>
                {auction.winnerId && (
                  <p className="text-sm text-gray-600 mt-2">Winner: {auction.winnerId?.fullName}</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleLike}
                className={`flex-1 flex items-center justify-center gap-2 bg-white border py-2 rounded-lg hover:bg-gray-50 transition ${
                  liked ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-700'
                }`}
              >
                <Heart className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} />
                <span className="font-semibold">{likeCount}</span>
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                <Share2 className="w-5 h-5" />
                {copied && <span className="font-semibold text-sm">Link copied</span>}
              </button>
            </div>
          </div>
        </div>

        {auction.bids && auction.bids.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-black mb-4">Bid History</h3>
            <div className="space-y-3">
              {[...auction.bids].reverse().map((bid: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                  <div>
                    <p className="font-semibold text-black">{bid.bidderId?.fullName || 'Anonymous'}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(bid.timestamp).toLocaleDateString()} at {new Date(bid.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-blue-600">₦{bid.amount?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-black mb-4">Comments ({commentCount})</h3>

          {currentUser ? (
            <form onSubmit={handlePostComment} className="mb-6">
              {commentError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-sm">
                  {commentError}
                </div>
              )}
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{commentText.length}/500</span>
                <button
                  type="submit"
                  disabled={posting || !commentText.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {posting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-gray-600 mb-6">
              <Link href="/login" className="text-blue-600 font-bold hover:underline">
                Log in
              </Link>{' '}
              to join the conversation.
            </p>
          )}

          {comments.length === 0 ? (
            <p className="text-gray-500">No comments yet. Be the first to comment.</p>
          ) : (
            <div className="space-y-4">
              {comments.map((c: any) => {
                const isAuthor = !!(currentUser && c.userId?._id === currentUser._id);
                const canDelete = isAuthor || isSellerLoggedIn || isAdmin;
                return (
                  <div key={c._id} className="flex gap-3 py-3 border-b border-gray-100 last:border-b-0">
                    <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white font-bold">
                      {c.userId?.fullName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-black text-sm">
                          {c.userId?.fullName || 'User'}
                          {c.userId?._id === sellerId && (
                            <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Seller</span>
                          )}
                        </p>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteComment(c._id)}
                            className="text-xs text-red-600 hover:underline flex-shrink-0"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm mt-1 break-words whitespace-pre-wrap">{c.content}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(c.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}