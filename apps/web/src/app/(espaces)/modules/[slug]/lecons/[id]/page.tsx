import type { Metadata } from 'next';
import { LessonReader } from './lesson-reader';

export const metadata: Metadata = { title: 'Leçon' };

export default function LessonPage() {
  return <LessonReader />;
}
