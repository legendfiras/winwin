import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import Storefront from '@/components/Storefront';
import Container from '@/components/Container';

const policies = {
  '/privacy-policy': {
    title: 'Privacy Policy',
    intro: 'This policy explains how WinWin collects, uses, and protects information when you browse, create an account, or place an order.',
    sections: [
      ['Information we collect', 'We may collect your name, phone number, email address, delivery details, account activity, loyalty information, and order history. We also receive basic technical data needed to keep the website secure and working correctly.'],
      ['How we use information', 'We use your information to manage your account, process and confirm orders, provide delivery and customer support, administer WinWin rewards, prevent misuse, and improve our services.'],
      ['Sharing and security', 'We only share information with service providers when needed to operate the store, complete an order, or comply with the law. We use reasonable safeguards and do not sell your personal information.'],
      ['Your choices', 'You may ask us to review, correct, or delete eligible personal information. You can also choose not to provide optional information, although some services may then be unavailable.'],
    ],
  },
  '/terms-and-conditions': {
    title: 'Terms & Conditions',
    intro: 'These terms govern your use of the WinWin website, customer account, loyalty benefits, and ordering services.',
    sections: [
      ['Orders and availability', 'Submitting an order is a request to purchase. Products, prices, promotions, and availability may change. An order becomes confirmed only after WinWin accepts it and confirms the details with you.'],
      ['Accounts and rewards', 'You are responsible for keeping your account details accurate and secure. Loyalty points and WinWin Card benefits have no cash value, are personal to the account holder, and may be corrected if issued in error or through misuse.'],
      ['Pricing and payment', 'We aim to display accurate pricing. If an obvious error occurs, we may contact you to confirm the corrected price or cancel the affected item before fulfillment. Payment and delivery arrangements are confirmed as part of the order process.'],
      ['Acceptable use', 'You may not misuse the website, interfere with its operation, attempt unauthorized access, or use its content or services for unlawful purposes.'],
    ],
  },
  '/shipping-policy': {
    title: 'Shipping Policy',
    intro: 'We coordinate delivery after your order has been reviewed and confirmed with you.',
    sections: [
      ['Order confirmation', 'After checkout, your order is reviewed for product availability and delivery details. We contact you through the information supplied with your order before fulfillment when confirmation is needed.'],
      ['Delivery timing', 'Delivery estimates depend on your location, product availability, and order volume. Any timing provided during confirmation is an estimate and may be affected by circumstances outside our control.'],
      ['Delivery details', 'Please provide a reachable phone number and complete address. Delays caused by missing or incorrect information may require a new delivery arrangement.'],
      ['Fees and inspection', 'Any applicable delivery fee is communicated during order confirmation. Please inspect your delivery promptly and contact us if an item is missing, damaged, or different from what was confirmed.'],
    ],
  },
  '/returns-and-refunds': {
    title: 'Returns & Refunds',
    intro: 'We want you to be happy with your order. Contact us promptly if there is a problem so we can review the best available solution.',
    sections: [
      ['Eligible returns', 'Return eligibility depends on the item’s condition and category. Items should generally be unused, complete, and in their original packaging. For hygiene, safety, or perishable reasons, some products may not be returnable.'],
      ['Damaged or incorrect items', 'If an item arrives damaged, defective, or different from the confirmed order, contact us as soon as possible with the order details and clear photos where relevant.'],
      ['Return approval', 'Please contact WinWin before sending anything back. Approved returns will include instructions for collection or drop-off. Unapproved returns may not be accepted.'],
      ['Refunds and exchanges', 'Once an approved return is inspected, we will confirm whether an exchange, store credit, or refund applies. Processing time depends on the original payment method and the circumstances of the return.'],
    ],
  },
};

export default function LegalPage() {
  const { pathname } = useLocation();
  const policy = policies[pathname] || policies['/privacy-policy'];

  useEffect(() => {
    document.title = `${policy.title} | WinWin`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    return () => { document.title = 'WinWin.leb'; };
  }, [policy.title]);

  return (
    <Storefront>
      <main className="bg-[linear-gradient(180deg,#f7ecdf_0%,#fffaf4_320px)] py-10 md:py-16">
        <Container className="max-w-4xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-[#7a1528]">
            <ArrowLeft className="h-4 w-4" /> Back to shop
          </Link>

          <div className="mt-7 rounded-[1.5rem] border border-[#9f1d35]/10 bg-white p-6 shadow-[0_24px_70px_rgba(80,36,28,0.08)] sm:p-10 md:p-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#9f1d35]/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#9f7226]">WinWin customer care</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-[#321a19] sm:text-4xl">{policy.title}</h1>
            <p className="mt-2 text-xs text-muted-foreground">Last updated October 1, 2026</p>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#5f5049]">{policy.intro}</p>

            <div className="mt-10 space-y-8 border-t border-[#321a19]/10 pt-8">
              {policy.sections.map(([heading, body]) => (
                <section key={heading}>
                  <h2 className="font-heading text-lg font-semibold text-[#321a19]">{heading}</h2>
                  <p className="mt-2 text-sm leading-7 text-[#6f625b]">{body}</p>
                </section>
              ))}
            </div>

            <div className="mt-10 rounded-2xl bg-[#faf6ef] p-5 text-sm leading-6 text-[#5f5049]">
              Questions about this policy? Use the <strong className="font-semibold text-[#321a19]">Chat with us</strong> link in the footer and our team will help.
            </div>
          </div>
        </Container>
      </main>
    </Storefront>
  );
}
