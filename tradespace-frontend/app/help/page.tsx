import Link from 'next/link';

const SECTIONS = [
  {
    title: 'Buying',
    items: [
      {
        q: 'How do bids work?',
        a: 'Place a bid higher than the current bid before the timer runs out. A bid is a promise to buy, so only bid on things you really want. Bids cannot be taken back once placed.',
      },
      {
        q: 'I won. What happens next?',
        a: 'When the seller accepts your bid, you get a notification and a Pay now button on the auction page. You have 3 days to pay. We send a reminder 24 hours before the deadline.',
      },
      {
        q: 'What if I do not pay within 3 days?',
        a: 'The item is offered to the next highest bidder, and you get a strike. After 3 strikes you can no longer place bids. If you think this was a mistake, contact support.',
      },
      {
        q: 'Is my money safe?',
        a: 'Yes. When you pay, TradeSpace holds the money. The seller is only paid after you confirm the item arrived, or automatically 7 days after payment if you do not report a problem.',
      },
      {
        q: 'The item arrived. What do I do?',
        a: 'Open the auction page and press I received the item. That pays the seller. Please only confirm once you have the item and it matches the description.',
      },
      {
        q: 'What if there is a problem with my order?',
        a: 'Press Report a problem on the auction page and pick a reason. The payment is frozen straight away and our team reviews it. If you were right, you are refunded. If the seller was right, they are paid.',
      },
    ],
  },
  {
    title: 'Selling',
    items: [
      {
        q: 'How do I sell something?',
        a: 'Create an auction with clear photos, an honest description and a starting price. It runs for 24 hours. You can go live on video from the auction page to show your item.',
      },
      {
        q: 'Why must I add a payout account?',
        a: 'We need to know where to send your money before a buyer is asked to pay. Add it under Profile, then Payout account. You can only accept a bid once it is added.',
      },
      {
        q: 'How do I accept a bid?',
        a: 'Press Accept next to any bid. You do not have to pick the highest one. The bidder then has 3 days to pay. If they do not, the item goes to the next highest bidder.',
      },
      {
        q: 'When do I get paid?',
        a: 'After the buyer confirms the item arrived, or automatically 7 days after they paid if they do not report a problem. TradeSpace keeps a commission (currently 10% of the sale price) and the rest goes to your bank account.',
      },
      {
        q: 'My auction ended with no sale. Can I try again?',
        a: 'Yes. Press Reopen on the expired auction to run it for another 24 hours. You can reopen an auction up to 3 times.',
      },
    ],
  },
  {
    title: 'Safety and privacy',
    items: [
      {
        q: 'Why can I not see the seller\'s phone number?',
        a: 'Contact details are private to stop scams and off-platform deals. They are shared between the seller and the buyer only after the sale is paid.',
      },
      {
        q: 'Someone asked me to pay outside TradeSpace.',
        a: 'Never do this. Payments outside TradeSpace are not protected, and we cannot help you get your money back. Report the person using the Report button.',
      },
      {
        q: 'How do I report something?',
        a: 'Use the Report button on an auction or a comment, choose a reason, and send it. Reports are private. We review them and tell you the outcome.',
      },
    ],
  },
  {
    title: 'Your account',
    items: [
      {
        q: 'I forgot my password.',
        a: 'On the sign in page, press Forgot password and enter your email. We send you a link that works for 1 hour. If no email arrives, check your spam folder or contact support.',
      },
      {
        q: 'How do I change my profile picture?',
        a: 'Go to your profile and press the camera icon on your picture.',
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-black">Help</h1>
          <p className="text-gray-600 mt-2">Quick answers about buying, selling and staying safe on TradeSpace.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-8">
            <h2 className="text-xl font-bold text-black mb-3">{section.title}</h2>
            <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
              {section.items.map((item) => (
                <details key={item.q} className="group p-5">
                  <summary className="cursor-pointer font-semibold text-black list-none flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                  </summary>
                  <p className="text-gray-700 mt-3 text-sm leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="font-semibold text-black mb-1">Still need help?</p>
          <p className="text-sm text-gray-700 mb-4">Send us a request and we will get back to you.</p>
          <Link
            href="/support"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}