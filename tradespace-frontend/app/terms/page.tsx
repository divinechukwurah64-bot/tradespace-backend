const SUPPORT_EMAIL = 'divinechukwurah64@gmail.com';
const LAST_UPDATED = 'November 6, 2026';

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
        These Terms and Conditions govern your access to and use of TradeSpace, including its
        auctions, Clear Space listings, messaging and any live features. By creating an account or
        using TradeSpace, you agree to these terms. If you do not agree, do not use the platform.
        These terms apply alongside applicable Nigerian law, including the Federal Competition and
        Consumer Protection Act 2018 (FCCPA) and the Nigeria Data Protection Act 2023 (NDP Act).
        Nothing here removes a consumer right that cannot lawfully be excluded.
      </p>

      <h2 style={h2}>1. About TradeSpace</h2>
      <p>
        TradeSpace is an online marketplace that lets users list goods for auction and advertise
        gigs or services through Clear Space. Unless a listing clearly says otherwise, the person
        identified as the seller or service provider is responsible for supplying the goods or
        services. TradeSpace provides the marketplace and is not a party to the sale between users.
        This does not limit any responsibility TradeSpace has under applicable law for its own
        services or conduct.
      </p>
      <p>
        Before you place an order or bid, review the listing and the information shown at checkout,
        including the seller or provider identity where supplied, item or service description, total
        price, delivery or performance terms, and any applicable fees. Sellers must provide any
        information required by Nigerian law. TradeSpace may not independently verify every user,
        listing or claim.
      </p>

      <h2 style={h2}>2. Your account</h2>
      <ul style={list}>
        <li>You must be at least 18 years old and legally able to enter into a contract to create an account or transact.</li>
        <li>You must provide accurate, current information and update it when it changes.</li>
        <li>Keep your password and authentication details secure. Tell us promptly if you suspect unauthorised access.</li>
        <li>You are responsible for activity carried out through your account, except where applicable law provides otherwise.</li>
        <li>Do not create or use multiple accounts to manipulate bids, reviews, rankings, or platform safeguards.</li>
      </ul>

      <h2 style={h2}>3. Buying and bidding</h2>
      <ul style={list}>
        <li>Read the listing, seller information, delivery terms, total price and applicable fees before bidding or ordering.</li>
        <li>A bid is an offer to buy on the listing terms. If you win, you must complete the purchase, subject to applicable law and any disclosed auction conditions.</li>
        <li>You cannot withdraw a bid after placing it unless the listing permits withdrawal, TradeSpace allows it, or applicable law gives you that right.</li>
        <li>You must not bid on your own listing, arrange false bids, collude with another bidder, or otherwise manipulate an auction.</li>
        <li>An auction closes at the time shown on its listing, subject to disclosed extensions, technical issues, cancellation, or applicable law. The highest valid bid wins if it meets any disclosed reserve price.</li>
        <li>TradeSpace may cancel or correct an auction affected by a material listing error, suspected fraud, unlawful activity, or a system fault, and will give affected users an explanation where reasonably practicable.</li>
      </ul>

      <h2 style={h2}>4. Selling and listing</h2>
      <ul style={list}>
        <li>You may list only goods or services you are legally entitled and qualified to sell or provide.</li>
        <li>Descriptions, photographs, condition, availability, qualifications, delivery terms and claims must be accurate, clear and not misleading.</li>
        <li>Show the full price and any material charges before a buyer commits. Do not add undisclosed charges after an order is placed.</li>
        <li>Do not list stolen, counterfeit, prohibited, unsafe or otherwise unlawful goods or services, or items whose sale requires a licence or approval you do not hold.</li>
        <li>Comply with applicable Nigerian laws, permits, tax obligations, product safety requirements and sector rules for your goods or services.</li>
        <li>After accepting an order or winning bid, fulfil it as described and within the delivery or performance time disclosed to the buyer. Communicate promptly about delays, cancellations or problems.</li>
        <li>You remain responsible for statutory consumer remedies, including any applicable rights relating to quality, safety, cancellation, returns, refunds or defective goods and services. A listing marked “no returns” or “no refunds” cannot remove rights that the law protects.</li>
        <li>TradeSpace may remove a listing or restrict an account when reasonably necessary to address a breach, a safety or fraud risk, or a legal requirement. We will provide notice and a route to raise a review request where appropriate and lawful.</li>
      </ul>

      <h2 style={h2}>5. Payments, fees and refunds</h2>
      <p>
        Payments on TradeSpace are processed by Paystack or another payment provider identified at
        checkout. Payment processing is subject to that provider’s terms. TradeSpace does not store
        full card details. We may receive transaction information needed to operate the marketplace,
        prevent fraud, provide support and meet legal obligations. The total amount payable and any
        TradeSpace fee will be shown before you confirm payment. Your bank or payment provider may
        charge separate fees.
      </p>
      <p>
        Refunds, reversals and cancellations are handled under the listing terms, payment-provider
        process and applicable law. Nothing in these terms guarantees that a payment can be reversed
        or prevents a remedy required by law. Contact us promptly if a payment appears unauthorised,
        duplicated or incorrect. Do not share your full card number, PIN or one-time password with
        another user or with TradeSpace support.
      </p>

      <h2 style={h2}>6. Prohibited conduct</h2>
      <ul style={list}>
        <li>Fraud, scams, false bids, fake reviews, impersonation or attempts to deceive another user.</li>
        <li>Harassment, threats, discriminatory abuse, or sharing another person’s private information without a lawful basis.</li>
        <li>Using TradeSpace to sell unlawful goods or services, launder money, evade sanctions, or facilitate another offence.</li>
        <li>Manipulating or evading a disclosed platform fee, buyer protection measure or transaction safeguard.</li>
        <li>Unauthorised access, scraping, malware, interference with the platform, or attempts to bypass security controls.</li>
        <li>Posting content that is unlawful, sexually exploitative, threatening, infringing, or otherwise prohibited by these terms.</li>
      </ul>

      <h2 style={h2}>7. User content and live streams</h2>
      <p>
        You retain your rights in content you submit. You give TradeSpace a non-exclusive,
        worldwide, royalty-free permission to host, reproduce, display and distribute that content
        as reasonably needed to operate, promote and protect the marketplace. This permission ends
        when the content is deleted, except where retention is needed for a transaction record,
        dispute, legal obligation, or backup cycle. You confirm that you have the rights and
        permissions needed to submit the content.
      </p>
      <p>
        Where live features are available, you may broadcast only content and items you are entitled
        to show. Streams must comply with these terms and applicable law. We may stop or restrict a
        stream to address a breach, safety risk or legal requirement, and will provide a reason where
        reasonably practicable.
      </p>

      <h2 style={h2}>8. Moderation and account action</h2>
      <p>
        We may investigate reports, remove or restrict listings or content, cancel an auction, or
        suspend or close an account where we reasonably believe there is a breach of these terms, a
        risk to users or the platform, suspected fraud, or a legal requirement. Where appropriate,
        we will notify you of the action and its reason and provide a way to request review. We may
        act without advance notice when necessary to prevent harm, preserve evidence or comply with
        law. You may contact us to appeal an account or content decision.
      </p>

      <h2 style={h2}>9. Complaints and disputes</h2>
      <p>
        For a transaction issue, contact the other party first where it is safe and practical, and
        keep relevant messages, receipts and listing details. You may also contact TradeSpace at
        {` `}<strong>{Divinechukwurah64@gmail.com}</strong>. We will review platform complaints and aim to respond
        within a reasonable time. Any internal review relates to TradeSpace’s platform services; it
        does not determine a user’s legal rights or prevent you from seeking a remedy from the seller,
        a relevant regulator, the Federal Competition and Consumer Protection Commission (FCCPC),
        another competent authority, or a court.
      </p>

      <h2 style={h2}>10. Privacy and personal information</h2>
      <p>
        Our Privacy Policy explains what personal information we collect, why and how we use it, who
        we share it with, how long we retain it, and how to exercise your rights under the NDP Act.
        Read it at <a href="/privacy-policy">Privacy Policy</a>. We process personal information
        in accordance with applicable Nigerian data protection law. Do not post payment credentials
        or sensitive personal information in listings, reviews or public messages.
      </p>

      <h2 style={h2}>11. Availability and responsibility</h2>
      <p>
        We work to keep TradeSpace available and secure, but cannot promise uninterrupted or
        error-free service. To the extent permitted by Nigerian law, TradeSpace is not responsible
        for a loss caused by another user’s goods, services, conduct or failure to perform a
        transaction. Nothing in these terms excludes or limits liability that cannot lawfully be
        excluded or limited, including applicable statutory consumer rights or liability for fraud,
        wilful misconduct, or death or personal injury caused by negligence.
      </p>

      <h2 style={h2}>12. Changes to TradeSpace or these terms</h2>
      <p>
        We may update these terms to reflect changes to the platform, our practices or applicable
        law. We will update the date above and, where a change materially affects your rights or
        obligations, give reasonable notice through the platform or another appropriate channel.
        Changes apply from the stated effective date. If you do not agree, stop using the affected
        features and contact us about your account. Continued use after the effective date indicates
        acceptance only to the extent permitted by law; it does not waive rights that cannot be
        waived.
      </p>

      <h2 style={h2}>13. Suspension, closure and records</h2>
      <p>
        You may stop using TradeSpace and request account closure by contacting us. Outstanding
        transactions, payment obligations, dispute handling and records we must retain by law may
        continue after closure. Sections that by their nature need to continue, including provisions
        on payments, user content, liability, disputes and governing law, will remain effective to
        that extent.
      </p>

      <h2 style={h2}>14. Governing law and contact</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria. Disputes are subject
        to the jurisdiction of the courts of competent jurisdiction in Nigeria, without limiting any
        right to complain to a regulator or seek another remedy available under Nigerian law.
      </p>
      <p>
        Questions, complaints or requests about these terms? Email <strong>{Divinechukwurah64@gmail.com}</strong>.
        Please include enough information for us to identify the relevant account or transaction,
        but do not send passwords, PINs or one-time passwords.
      </p>
    </div>
  );
}
