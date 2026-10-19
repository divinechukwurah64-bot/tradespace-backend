const SUPPORT_EMAIL = 'divinechukwurah64@gmail.com';
const LAST_UPDATED = 'October 18, 2026';

const page: React.CSSProperties = {
  maxWidth: 800,
  margin: '0 auto',
  padding: '40px 16px 64px',
  color: '#e9ecf3',
  lineHeight: 1.7,
};

const h1: React.CSSProperties = { fontSize: 32, fontWeight: 700, marginBottom: 4 };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 };
const muted: React.CSSProperties = { color: '#6b7280', marginBottom: 24 };
const list: React.CSSProperties = { paddingLeft: 22, margin: '8px 0' };

export default function TermsPage() {
  return (
    <div style={page}>
      <h1 style={h1}>Terms and Conditions</h1>
      <p style={muted}>Last updated: {LAST_UPDATED}</p>

      <p>
        Welcome to TradeSpace. By creating an account or using the platform, you agree to these
        terms. If you do not agree, please do not use TradeSpace.
      </p>

      <h2 style={h2}>1. About TradeSpace</h2>
      <p>
        TradeSpace is an online marketplace with two parts: auctions, where users sell items to the
        highest bidder, and Clear Space, where users list gigs and services. TradeSpace provides
        the platform. We are not the seller of items or the provider of services listed by users.
      </p>

      <h2 style={h2}>2. Your account</h2>
      <ul style={list}>
        <li>You must be at least 18 years old to create an account.</li>
        <li>You must give accurate information and keep your login details private.</li>
        <li>You are responsible for everything that happens under your account.</li>
        <li>One person may not run multiple accounts to manipulate bids or ratings.</li>
      </ul>

      <h2 style={h2}>3. Buying and bidding</h2>
      <ul style={list}>
        <li>A bid is a binding commitment to buy the item if you win.</li>
        <li>Bids cannot be withdrawn once placed.</li>
        <li>You may not bid on your own auction or use others to raise the price.</li>
        <li>The auction ends at the time shown on the listing, and the highest valid bid wins.</li>
      </ul>

      <h2 style={h2}>4. Selling and listing</h2>
      <ul style={list}>
        <li>You must own, or have the right to sell, everything you list.</li>
        <li>Titles, descriptions, photos and conditions must be honest and accurate.</li>
        <li>
          You may not list illegal, stolen, counterfeit or dangerous items, or anything that
          breaks Nigerian law.
        </li>
        <li>You must deliver the item or service as described once a sale is completed.</li>
        <li>
          Sellers who do not deliver, or who misdescribe items, may have their listings removed
          and their accounts suspended.
        </li>
      </ul>

      <h2 style={h2}>5. Payments</h2>
      <p>
        Payments are processed through our payment provider, Paystack. TradeSpace does not store
        your card details. Fees, if any, will be shown before you confirm a transaction. You are
        responsible for any bank or payment charges on your side.
      </p>

      <h2 style={h2}>6. Prohibited conduct</h2>
      <ul style={list}>
        <li>Fraud, fake bids, fake reviews or any attempt to cheat other users.</li>
        <li>Harassment, hate speech, threats or abusive messages.</li>
        <li>Moving a transaction off the platform to avoid fees or protections.</li>
        <li>Attempting to hack, disrupt or misuse the platform.</li>
        <li>Posting content that is illegal, explicit or violates someone else&apos;s rights.</li>
      </ul>

      <h2 style={h2}>7. Live streams</h2>
      <p>
        Where live features are available, you must only broadcast items and content you are
        allowed to show. Streams must follow these terms. We may end any stream at any time.
      </p>

      <h2 style={h2}>8. Moderation and suspension</h2>
      <p>
        TradeSpace administrators may remove listings, end auctions, and suspend or ban accounts
        that break these terms or put other users at risk. We may do this without prior notice
        where we think it is necessary to protect the platform and its users.
      </p>

      <h2 style={h2}>9. Disputes</h2>
      <p>
        If you have a problem with a transaction, contact the other party first. If you cannot
        resolve it, contact us and we will review the case. Our decision on platform matters, such
        as removing a listing or account, is final.
      </p>

      <h2 style={h2}>10. Limits of our responsibility</h2>
      <p>
        TradeSpace is provided &quot;as is&quot;. We do not guarantee that every listing is
        accurate or that every user will behave honestly. To the extent the law allows, we are not
        responsible for losses that result from dealings between users.
      </p>

      <h2 style={h2}>11. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. If you keep using TradeSpace after a change,
        you accept the new terms.
      </p>

      <h2 style={h2}>12. Contact</h2>
      <p>
        Questions about these terms? Email us at <strong>{SUPPORT_EMAIL}</strong>.
      </p>
    </div>
  );
}