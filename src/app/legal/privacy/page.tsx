import { Zap, ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 mb-8 text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-green-400" />
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        </div>

        <p className="text-white/50 mb-8">Last Updated: January 2025</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <p className="text-white/70 leading-relaxed">
            This Privacy Policy explains how AiRA (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) collects, uses, and protects user information.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>
            <p className="text-white/70 mb-4">We may collect the following information:</p>
            
            <div className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="font-semibold text-white mb-2">a) Account Information</h3>
                <ul className="list-disc pl-6 text-white/60 space-y-1 text-sm">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Login identifiers</li>
                </ul>
              </div>
              
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="font-semibold text-white mb-2">b) Platform Usage Data</h3>
                <ul className="list-disc pl-6 text-white/60 space-y-1 text-sm">
                  <li>Feature usage</li>
                  <li>Strategy configurations</li>
                  <li>Interaction logs (non-financial)</li>
                </ul>
              </div>
              
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="font-semibold text-white mb-2">c) Technical Data</h3>
                <ul className="list-disc pl-6 text-white/60 space-y-1 text-sm">
                  <li>Device type</li>
                  <li>Browser information</li>
                  <li>IP address</li>
                  <li>Log and diagnostic data</li>
                </ul>
              </div>
            </div>

            <p className="text-white/70 mt-4">
              We do not collect or store sensitive personal data beyond what is required to operate the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Information</h2>
            <p className="text-white/70 mb-2">We use collected information to:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>Provide and improve Platform functionality</li>
              <li>Maintain security and performance</li>
              <li>Communicate important updates</li>
              <li>Enforce Terms & Conditions</li>
              <li>Process payments and manage subscriptions</li>
            </ul>
            <p className="text-white/70 mt-4 font-medium">
              We do not use user data for advisory or decision-making purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Data Sharing</h2>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li><strong className="text-white">We do not sell user data</strong></li>
              <li>We do not share user data for marketing without consent</li>
            </ul>
            
            <p className="text-white/70 mt-4 mb-2">Data may be shared only:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>To comply with legal obligations</li>
              <li>To protect platform integrity</li>
              <li>With trusted service providers for infrastructure support</li>
              <li>With payment processors to handle transactions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Data Security</h2>
            <p className="text-white/70 mb-4">
              We implement reasonable technical and organizational measures to protect data, including:
            </p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>Encryption of data in transit (SSL/TLS)</li>
              <li>Secure credential storage with encryption at rest</li>
              <li>Access controls and authentication</li>
              <li>Regular security audits</li>
            </ul>
            <p className="text-white/70 mt-4">
              However, no system is 100% secure. Users acknowledge and accept this risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Data Retention</h2>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>Data is retained only as long as necessary for platform operations</li>
              <li>Users may request account deletion, subject to legal or operational requirements</li>
              <li>Some data may be retained for compliance purposes even after account deletion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. User Rights</h2>
            <p className="text-white/70 mb-2">Users may:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>Access their account data</li>
              <li>Update personal information</li>
              <li>Request deletion or correction (where applicable)</li>
              <li>Export their strategy configurations</li>
              <li>Opt out of non-essential communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Cookies & Tracking</h2>
            <p className="text-white/70 mb-2">AiRA may use cookies or similar technologies for:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>Authentication and session management</li>
              <li>Performance optimization</li>
              <li>User experience improvement</li>
              <li>Analytics (anonymized)</li>
            </ul>
            <p className="text-white/70 mt-4">
              Users may control cookie settings through their browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Third-Party Services</h2>
            <p className="text-white/70 mb-2">AiRA may integrate with third-party services including:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>Payment processors (for subscription management)</li>
              <li>Broker APIs (at user&apos;s discretion)</li>
              <li>Analytics services</li>
              <li>Cloud infrastructure providers</li>
            </ul>
            <p className="text-white/70 mt-4">
              These services have their own privacy policies and we encourage users to review them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Policy Updates</h2>
            <p className="text-white/70">
              This Privacy Policy may be updated periodically. We will notify users of significant changes via email or platform notification.
              Continued use of the Platform indicates acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. Contact Us</h2>
            <p className="text-white/70">
              If you have questions about this Privacy Policy or your data, please contact us at:{" "}
              <a href="mailto:privacy@aira.trade" className="text-blue-400 hover:text-blue-300">
                privacy@aira.trade
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Governing Law</h2>
            <p className="text-white/70">
              This Privacy Policy is governed by the laws of India.
            </p>
          </section>

          <div className="mt-12 p-6 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-400 mb-2">Your Privacy Matters</h3>
                <p className="text-green-300/80">
                  We are committed to protecting your privacy and handling your data responsibly. 
                  We do not sell your data and only collect what is necessary to provide our services.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <Link href="/legal/terms" className="text-sm text-white/40 hover:text-white/60 transition-colors">Terms & Conditions</Link>
            <Link href="/legal/privacy" className="text-sm text-green-400">Privacy Policy</Link>
            <Link href="/legal/risk-disclosure" className="text-sm text-white/40 hover:text-white/60 transition-colors">Risk Disclosure</Link>
          </div>
          <p className="text-xs text-white/20">© 2025 AiRA. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
