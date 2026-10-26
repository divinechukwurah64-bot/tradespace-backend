'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteTrack } from 'livekit-client';
import API from '@/lib/api';
import { confirmDialog, toast } from '@/lib/dialogs';

type Status = 'idle' | 'connecting' | 'live' | 'ended';

export default function LivePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [auction, setAuction] = useState<any>(null);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [hasVideo, setHasVideo] = useState(false);
  const [paused, setPaused] = useState(false);
  const [remotePaused, setRemotePaused] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState('');
  const [bidding, setBidding] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioBoxRef = useRef<HTMLDivElement>(null);
  const autoWatchTried = useRef(false);

  // Must be logged in to host or watch
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const raw = localStorage.getItem('user');
    setMe(raw ? JSON.parse(raw) : null);
    setReady(true);
  }, []);

  const loadAuction = async () => {
    try {
      const res = await API.get(`/auctions/${id}`);
      setAuction(res.data);
      setLoadError('');
    } catch (err: any) {
      if (err.response?.status === 404) setLoadError('Auction not found');
    }
  };

  // Load the auction and refresh it every 3 seconds so bids show up live
  useEffect(() => {
    if (!ready) return;
    loadAuction();
    const timer = setInterval(loadAuction, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id]);

  // Leave the room when the page closes
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  const isHost = !!(me && auction && auction.sellerId && auction.sellerId._id === me._id);

  const attachRemote = (track: RemoteTrack) => {
    if (track.kind === Track.Kind.Video && videoRef.current) {
      track.attach(videoRef.current);
      setHasVideo(true);
      // If the seller was already paused when this viewer joined
      setRemotePaused(track.isMuted);
    } else if (track.kind === Track.Kind.Audio && audioBoxRef.current) {
      audioBoxRef.current.appendChild(track.attach());
    }
  };

  const createRoom = () => {
    const room = new Room();
    room.on(RoomEvent.TrackSubscribed, (track) => attachRemote(track));
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
      if (track.kind === Track.Kind.Video) setHasVideo(false);
    });
    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (!participant.isLocal && publication.kind === Track.Kind.Video) setRemotePaused(true);
    });
    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (!participant.isLocal && publication.kind === Track.Kind.Video) setRemotePaused(false);
    });
    room.on(RoomEvent.ParticipantConnected, () => setViewerCount(room.remoteParticipants.size));
    room.on(RoomEvent.ParticipantDisconnected, () => setViewerCount(room.remoteParticipants.size));
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio));
    room.on(RoomEvent.Disconnected, () => {
      setStatus((s) => (s === 'live' ? 'ended' : s));
      setHasVideo(false);
      setPaused(false);
      setRemotePaused(false);
    });
    return room;
  };

  const handleAuthError = (err: any) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return true;
    }
    return false;
  };

  // VIEWER: join the stream
  const watch = async () => {
    setStatus('connecting');
    setError('');
    try {
      const res = await API.post(`/live/${id}/watch`);
      const room = createRoom();
      roomRef.current = room;
      await room.connect(res.data.url, res.data.token);
      setAudioBlocked(!room.canPlaybackAudio);
      setStatus('live');
    } catch (err: any) {
      if (handleAuthError(err)) return;
      roomRef.current?.disconnect();
      roomRef.current = null;
      setError(err.response?.data?.error || 'Could not join the stream');
      setStatus('idle');
    }
  };

  // SELLER: start broadcasting
  const goLive = async () => {
    setStatus('connecting');
    setError('');
    let started = false;
    try {
      const res = await API.post(`/live/${id}/start`);
      started = true;
      const room = createRoom();
      roomRef.current = room;
      await room.connect(res.data.url, res.data.token);
      const cam = await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (cam?.track && videoRef.current) {
        cam.track.attach(videoRef.current);
      }
      setHasVideo(true);
      setPaused(false);
      setViewerCount(room.remoteParticipants.size);
      setStatus('live');
      toast.success('You are live');
      loadAuction();
    } catch (err: any) {
      if (handleAuthError(err)) return;
      roomRef.current?.disconnect();
      roomRef.current = null;
      if (started) {
        try {
          await API.post(`/live/${id}/end`);
        } catch (e) {
          // ignore
        }
      }
      setError(
        err.response?.data?.error ||
          'Could not start the stream. Allow camera and microphone access in your browser, then try again.'
      );
      setStatus('idle');
      loadAuction();
    }
  };

  // SELLER: pause or resume. The seller stays connected, so viewers keep the same stream.
  const togglePause = async () => {
    const room = roomRef.current;
    if (!room || togglingPause) return;

    setTogglingPause(true);
    try {
      if (!paused) {
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.setMicrophoneEnabled(false);
        setPaused(true);
        toast.info('Stream paused. Viewers see a pause message.');
      } else {
        const cam = await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (cam?.track && videoRef.current) {
          cam.track.attach(videoRef.current);
        }
        setPaused(false);
        toast.success('You are live again');
      }
    } catch (err) {
      toast.error('Could not change the stream. Allow camera and microphone access and try again.');
    } finally {
      setTogglingPause(false);
    }
  };

  const endStream = async () => {
    const ok = await confirmDialog({
      title: 'End the live stream?',
      message: 'Everyone watching will be disconnected.',
      confirmText: 'End stream',
      danger: true,
    });
    if (!ok) return;

    try {
      await API.post(`/live/${id}/end`);
    } catch (err: any) {
      if (handleAuthError(err)) return;
      toast.error(err.response?.data?.error || 'Could not end the stream');
      return;
    }
    roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus('ended');
    setHasVideo(false);
    setPaused(false);
    toast.success('Stream ended');
    loadAuction();
  };

  // VIEWER: join automatically if the auction is live
  useEffect(() => {
    if (!ready || !auction || isHost) return;
    if (auction.isLive && status === 'idle' && !autoWatchTried.current) {
      autoWatchTried.current = true;
      watch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, auction, isHost, status]);

  // VIEWER: leave when the seller ends the stream
  useEffect(() => {
    if (!isHost && auction && !auction.isLive && status === 'live') {
      roomRef.current?.disconnect();
      roomRef.current = null;
      setStatus('ended');
    }
  }, [auction, isHost, status]);

  const enableSound = async () => {
    try {
      await roomRef.current?.startAudio();
      setAudioBlocked(false);
    } catch (e) {
      // ignore
    }
  };

  const placeBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidError('');
    const amount = Number(bidAmount);
    const minimum = auction.currentBid || auction.startingBid;

    if (!amount || amount <= minimum) {
      setBidError(`Your bid must be higher than \u20A6${Number(minimum).toLocaleString()}`);
      return;
    }

    setBidding(true);
    try {
      await API.post(`/auctions/${id}/bids`, { amount });
      setBidAmount('');
      toast.success('Your bid was placed');
      await loadAuction();
    } catch (err: any) {
      if (handleAuthError(err)) return;
      setBidError(err.response?.data?.error || 'Could not place the bid');
    } finally {
      setBidding(false);
    }
  };

  if (!ready) return null;

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-4">{loadError}</p>
          <Link href="/auctions" className="text-blue-600 hover:underline">
            Back to Auctions
          </Link>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading...
      </div>
    );
  }

  const currentPrice = auction.currentBid || auction.startingBid;
  const auctionOver = auction.status !== 'active' || new Date(auction.endsAt) < new Date();
  const recentBids = [...(auction.bids || [])].reverse().slice(0, 6);

  let overlay = '';
  if (status === 'connecting') overlay = 'Connecting...';
  else if (status === 'live' && isHost && paused) overlay = 'Stream paused. Viewers can see you are away.';
  else if (status === 'live' && !isHost && remotePaused) overlay = 'The seller paused the stream. It will resume soon.';
  else if (status === 'live' && !hasVideo) overlay = isHost ? 'Starting your camera...' : "Waiting for the seller's video...";
  else if (status === 'ended') overlay = 'The stream has ended';
  else if (status === 'idle') {
    if (isHost) overlay = 'Press Go Live to start streaming';
    else overlay = auction.isLive ? 'Joining the stream...' : 'This auction is not live right now';
  }

  const showPausedBadge = status === 'live' && (isHost ? paused : remotePaused);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link href={`/auctions/${id}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-5 h-5" />
            Back to auction
          </Link>
          <h1 className="text-3xl font-bold text-black">{auction.title}</h1>
          <p className="text-gray-600 mt-1">
            Seller: {auction.sellerId?.fullName || 'Unknown'}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div ref={audioBoxRef} className="hidden" />

            {status === 'live' && (
              <span
                className={`absolute top-3 left-3 text-white text-xs font-bold px-3 py-1 rounded-full ${
                  showPausedBadge ? 'bg-yellow-500' : 'bg-red-600'
                }`}
              >
                {showPausedBadge ? 'PAUSED' : 'LIVE'}
              </span>
            )}

            {isHost && status === 'live' && (
              <span className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-full">
                {viewerCount} watching
              </span>
            )}

            {overlay && (
              <div
                className={`absolute inset-0 flex items-center justify-center text-white text-lg px-4 text-center ${
                  showPausedBadge ? 'bg-black/70' : ''
                }`}
              >
                {overlay}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-4">
            {isHost && status !== 'live' && status !== 'connecting' && !auctionOver && (
              <button
                onClick={goLive}
                className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700"
              >
                Go Live
              </button>
            )}

            {isHost && status === 'live' && (
              <button
                onClick={togglePause}
                disabled={togglingPause}
                className={`px-6 py-2 rounded-lg font-bold text-white disabled:bg-gray-400 ${
                  paused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                {paused ? 'Resume stream' : 'Pause stream'}
              </button>
            )}

            {isHost && (status === 'live' || auction.isLive) && (
              <button
                onClick={endStream}
                className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-black"
              >
                End Stream
              </button>
            )}

            {!isHost && status === 'ended' && auction.isLive && (
              <button
                onClick={watch}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
              >
                Reconnect
              </button>
            )}

            {!isHost && status === 'live' && audioBlocked && (
              <button
                onClick={enableSound}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
              >
                Tap to enable sound
              </button>
            )}
          </div>

          {isHost && auctionOver && (
            <p className="text-gray-600 text-sm mt-3">This auction has ended, so you cannot go live.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 h-fit">
          <p className="text-sm text-gray-600">Current Bid</p>
          <p className="text-3xl font-bold text-blue-600 mb-4">
            {'\u20A6'}{Number(currentPrice).toLocaleString()}
          </p>

          {isHost ? (
            <p className="text-sm text-gray-600">You are the seller of this auction.</p>
          ) : auctionOver ? (
            <p className="text-sm text-gray-600">This auction has ended.</p>
          ) : (
            <form onSubmit={placeBid}>
              {bidError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">
                  {bidError}
                </div>
              )}
              <label className="block text-sm font-bold text-gray-700 mb-2">Your bid ({'\u20A6'})</label>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={String(Number(currentPrice) + 100)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white mb-3"
              />
              <button
                type="submit"
                disabled={bidding}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
              >
                {bidding ? 'Placing bid...' : 'Place Bid'}
              </button>
            </form>
          )}

          <div className="mt-6">
            <p className="text-sm font-bold text-gray-700 mb-2">Recent bids</p>
            {recentBids.length === 0 && <p className="text-sm text-gray-500">No bids yet</p>}
            {recentBids.map((b: any, i: number) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span className="text-gray-700">{b.bidderId?.fullName || 'Bidder'}</span>
                <span className="font-bold text-black">
                  {'\u20A6'}{Number(b.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}