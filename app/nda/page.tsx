import type {Metadata} from 'next';
import LegalPage from '../legal-page';
import NdaContent from '../nda-content';

export const metadata:Metadata={title:'Beta Tester NDA · B.E.I.P.I. Bot',description:'B.E.I.P.I. Bot private beta tester non-disclosure agreement.'};

export default function NdaPage(){return <LegalPage eyebrow="PRIVATE BETA" title="Beta Tester Non-Disclosure Agreement" intro="This agreement protects unreleased B.E.I.P.I. features and private testing information while still letting testers share useful feedback.">
 <aside className="legal-callout"><strong>Viewing this page does not sign the agreement.</strong><p>Approved testers are asked to review and explicitly accept this NDA before their Tester Portal is unlocked.</p></aside>
 <NdaContent/>
 </LegalPage>}
