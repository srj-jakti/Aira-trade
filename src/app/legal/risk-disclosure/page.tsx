import { ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 mb-8 text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold text-white">Risk Disclosure</h1>
        </div>

        <p className="text-white/50 mb-8">Last Updated: January 2025</p>

        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-8">
          <p className="text-red-300 font-medium">
            This Risk Disclosure applies to all users of the AiRA platform (&quot;Platform&quot;). 
            By accessing or using AiRA, you acknowledge and agree to the following risks.
          </p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. General Risk Acknowledgement</h2>
            <p className="text-white/70 mb-4">
              Trading and investing in financial markets involves significant risk, including the risk of partial or total loss of capital.
            </p>
            
            <p className="text-white/70 mb-2"><strong className="text-white">AiRA is a software platform and does not provide:</strong></p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>Investment advice</li>
              <li>Trading advice</li>
              <li>Buy or sell recommendations</li>
              <li>Assured or guaranteed returns</li>
            </ul>

            <p className="text-white/70 mt-4">
              All actions taken using the Platform are entirely at the user&apos;s discretion and responsibility.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. No Guarantee of Performance</h2>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>Past performance of any strategy, logic, or system does not guarantee future results</li>
              <li>Market conditions may change rapidly and unpredictably</li>
              <li>Strategies that perform well in testing or historical data may fail in live environments</li>
            </ul>
            <p className="text-white/70 mt-4 font-medium">
              AiRA does not guarantee profitability, accuracy, reliability, or suitability of any output.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Automation & System Risk</h2>
            <p className="text-white/70 mb-2">Use of automated systems carries inherent risks, including:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>Incorrect configurations by the user</li>
              <li>Software delays or interruptions</li>
              <li>Market volatility or price gaps</li>
              <li>Connectivity or infrastructure issues</li>
              <li>Broker API limitations or failures</li>
              <li>Slippage and execution delays</li>
            </ul>
            <p className="text-white/70 mt-4">
              The Platform executes actions only based on user-defined logic and does not monitor or intervene in outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Data & Market Information Risk</h2>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>Charts, indicators, and analytics are provided for informational purposes only</li>
              <li>Data may be delayed, incomplete, or inaccurate due to external factors</li>
              <li>AiRA does not warrant the correctness or completeness of any data displayed</li>
              <li>Users must independently verify information before acting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. User Responsibility</h2>
            <p className="text-white/70 mb-2">You acknowledge that:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>You understand the risks involved in market participation</li>
              <li>You are financially capable of bearing potential losses</li>
              <li>You are responsible for ensuring compliance with applicable laws and regulations</li>
              <li>You will not trade with money you cannot afford to lose</li>
              <li>You have read and understood this Risk Disclosure</li>
            </ul>
            <p className="text-white/70 mt-4">
              If required, users should seek advice from a SEBI-registered investment advisor.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Limitation of Liability</h2>
            <p className="text-white/70 mb-2">To the maximum extent permitted by law, AiRA shall not be liable for:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-1">
              <li>Financial losses</li>
              <li>Missed opportunities</li>
              <li>Strategy failures</li>
              <li>Technical or system errors</li>
              <li>Third-party service failures (brokers, data providers, etc.)</li>
              <li>Any direct, indirect, incidental, or consequential damages</li>
            </ul>
            <p className="text-white/70 mt-4 font-medium">
              Use of the Platform is entirely at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Specific Risks by Asset Class</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Equity Trading</h3>
                <p className="text-white/60 text-sm">
                  Stock prices can be volatile and may decline significantly. There is no guarantee that you will 
                  be able to sell at favorable prices.
                </p>
              </div>
              
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Futures & Options (F&O)</h3>
                <p className="text-white/60 text-sm">
                  Derivatives trading involves high leverage and can result in losses exceeding your initial margin. 
                  Options can expire worthless. Only trade F&O if you fully understand the risks.
                </p>
              </div>
              
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Intraday Trading</h3>
                <p className="text-white/60 text-sm">
                  Intraday trading carries additional risks including higher transaction costs, margin calls, 
                  and forced square-off by brokers.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Regulatory & Tax Considerations</h2>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>Users are solely responsible for compliance with SEBI, exchange, and broker regulations</li>
              <li>Users must comply with all applicable tax laws and reporting requirements</li>
              <li>AiRA does not provide tax advice or regulatory guidance</li>
            </ul>
          </section>

          <div className="mt-12 p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-400 mb-2">Important Notice</h3>
                <p className="text-amber-300/80">
                  AiRA is a software platform providing analytical and automation tools only. 
                  It does not provide investment advice or trading recommendations. 
                  Trading in financial markets involves substantial risk. 
                  Only trade with capital you can afford to lose.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <Link href="/legal/terms" className="text-sm text-white/40 hover:text-white/60 transition-colors">Terms & Conditions</Link>
            <Link href="/legal/privacy" className="text-sm text-white/40 hover:text-white/60 transition-colors">Privacy Policy</Link>
            <Link href="/legal/risk-disclosure" className="text-sm text-red-400">Risk Disclosure</Link>
          </div>
          <p className="text-xs text-white/20">© 2025 AiRA. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
