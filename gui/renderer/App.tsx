import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { KnowledgeView } from './views/KnowledgeView';
import { SyllabusView } from './views/SyllabusView';
import { LessonsView } from './views/LessonsView';
import { LessonDetail } from './views/LessonDetail';
import { QualityView } from './views/QualityView';
import { QualityReport } from './views/QualityReport';
import { VideoView } from './views/VideoView';
import { SettingsView } from './views/SettingsView';

export function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/knowledge" element={<KnowledgeView />} />
          <Route path="/syllabus" element={<SyllabusView />} />
          <Route path="/lessons" element={<LessonsView />} />
          <Route path="/lessons/:lessonId" element={<LessonDetail />} />
          <Route path="/quality" element={<QualityView />} />
          <Route path="/quality/:lessonId" element={<QualityReport />} />
          <Route path="/video" element={<VideoView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
