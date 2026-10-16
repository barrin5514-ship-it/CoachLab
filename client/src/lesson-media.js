export const mediaCatalog = [
  { title: 'Knee-cut half-guard pass — Stephan Kesting', disciplines: ['Brazilian Jiu-Jitsu', 'MMA'], terms: /\bknee[ -](cut|slice|slide)\b/i, source: 'https://www.grapplearts.com/high-percentage-half-guard-pass-works-gi-no-gi/', image: 'https://www.grapplearts.com/wp-content/uploads/2017/10/crossface-vs-half-guard-strip-1024x266.jpg', video: 'https://www.youtube.com/embed/WWEI_NHdBxg', credit: 'Grapplearts / Stephan Kesting; half-guard variation' },
  { title: 'Double-leg takedown — David Avellan', disciplines: ['Wrestling', 'MMA'], terms: /\bdouble[ -]leg\b/i, source: 'https://davidavellan.com/specialize/', image: 'https://davidavellan.com/wp-content/uploads/2012/02/doubles-101.png', video: 'https://www.youtube.com/embed/tC6LTPcTpfg', credit: 'David Avellan' },
  { title: 'Supported mini-squat pictures and squat video — NHS', disciplines: ['Personal Training'], terms: /\bsquats?\b/i, source: 'https://www.nhs.uk/live-well/exercise/strength-exercises/', image: 'https://assets.nhs.uk/nhsuk-cms/images/STRENGTH_EXERCISES-_mini-squats.width-640.jpg', videoPage: 'https://www.nhs.uk/live-well/exercise/strength-and-flex-exercise-plan-how-to-videos/', credit: 'NHS; supported mini-squat variation' },
  { title: 'Kimura grips — Stephan Kesting', disciplines: ['Brazilian Jiu-Jitsu', 'MMA'], terms: /\bkimura\b/i, source: 'https://www.grapplearts.com/kimura-armlock-grips-explained/', image: 'https://www.grapplearts.com/wp-content/uploads/2015/05/timthumb.php_4.png', video: 'https://www.youtube.com/embed/qp0zShjuAbo', credit: 'Grapplearts / Stephan Kesting' },
  { title: 'Jab mechanics — Evolve MMA', disciplines: ['Boxing', 'Muay Thai', 'MMA'], terms: /\bjabs?\b/i, source: 'https://evolve-mma.com/blog/how-to-throw-a-stronger-and-more-powerful-jab/', image: 'https://cdn.evolve-mma.com/wp-content/uploads/2023/10/jab-edited-1024x576.jpg', video: 'https://www.youtube.com/embed/QiojSfHSBb4', credit: 'Evolve MMA' },
];
export function lessonMedia(lesson) {
  const text = [lesson.title, lesson.goal, lesson.drills].join(' ');
  return mediaCatalog.filter(item => item.disciplines.includes(lesson.discipline) && item.terms.test(text));
}
