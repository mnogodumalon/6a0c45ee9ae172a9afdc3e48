import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import ZusatzleistungenPage from '@/pages/ZusatzleistungenPage';
import ZusatzleistungenDetailPage from '@/pages/ZusatzleistungenDetailPage';
import KundenPage from '@/pages/KundenPage';
import KundenDetailPage from '@/pages/KundenDetailPage';
import KatzenPage from '@/pages/KatzenPage';
import KatzenDetailPage from '@/pages/KatzenDetailPage';
import BuchungenPage from '@/pages/BuchungenPage';
import BuchungenDetailPage from '@/pages/BuchungenDetailPage';
import PublicFormZusatzleistungen from '@/pages/public/PublicForm_Zusatzleistungen';
import PublicFormKunden from '@/pages/public/PublicForm_Kunden';
import PublicFormKatzen from '@/pages/public/PublicForm_Katzen';
import PublicFormBuchungen from '@/pages/public/PublicForm_Buchungen';
// <public:imports>
// </public:imports>
// <custom:imports>
const NeueBuchungPage = lazy(() => import('@/pages/intents/NeueBuchungPage'));
const AbreiseAbwickelnPage = lazy(() => import('@/pages/intents/AbreiseAbwickelnPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a0c45cd1be9f04e188b08dd" element={<PublicFormZusatzleistungen />} />
              <Route path="public/6a0c45c8906835b1ad00f90a" element={<PublicFormKunden />} />
              <Route path="public/6a0c45cdd4b461a56b9d6cb4" element={<PublicFormKatzen />} />
              <Route path="public/6a0c45ce17d0f305b7c53697" element={<PublicFormBuchungen />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="zusatzleistungen" element={<ZusatzleistungenPage />} />
                <Route path="zusatzleistungen/:id" element={<ZusatzleistungenDetailPage />} />
                <Route path="kunden" element={<KundenPage />} />
                <Route path="kunden/:id" element={<KundenDetailPage />} />
                <Route path="katzen" element={<KatzenPage />} />
                <Route path="katzen/:id" element={<KatzenDetailPage />} />
                <Route path="buchungen" element={<BuchungenPage />} />
                <Route path="buchungen/:id" element={<BuchungenDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/neue-buchung" element={<Suspense fallback={null}><NeueBuchungPage /></Suspense>} />
                <Route path="intents/abreise-abwickeln" element={<Suspense fallback={null}><AbreiseAbwickelnPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
