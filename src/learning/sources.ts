export type ResearchSource = Readonly<{
  id: string;
  title: string;
  authors: string;
  year: number;
  url: string;
  role: string;
}>;

export const researchSources: readonly ResearchSource[] = [
  {
    id: "zhu-2025",
    title: "Development of flipped classroom module FCM for music theory instruction",
    authors: "Zhu and colleagues",
    year: 2025,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12637912/",
    role: "Recent music-theory teaching design context; it does not validate this lab.",
  },
  {
    id: "wang-2025",
    title: "From Practice to Reflection: A Systematic Review of Mechanisms Driving Metacognition and SRL in Music",
    authors: "Wang and colleagues",
    year: 2025,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12734040/",
    role: "Supports structured plan–practice–reflection and explicit feedback loops, with study-level limits.",
  },
  {
    id: "azaryahu-2024",
    title: "Interplay between music and mathematics in the eyes of the beholder",
    authors: "Azaryahu, Ariel, and Leikin",
    year: 2024,
    url: "https://www.nature.com/articles/s41599-024-03631-z",
    role: "Qualitative expert perspectives on university-level music–mathematics integration.",
  },
  {
    id: "jacoby-2024",
    title: "Commonality and variation in mental representations of music revealed by a cross-cultural comparison of rhythm priors in 15 countries",
    authors: "Jacoby and colleagues",
    year: 2024,
    url: "https://www.nature.com/articles/s41562-023-01800-9",
    role: "Guards against treating one metric or representation of rhythm as culturally universal.",
  },
  {
    id: "marjieh-2024",
    title: "Timbral effects on consonance disentangle psychoacoustic mechanisms and suggest perceptual origins for musical scales",
    authors: "Marjieh and colleagues",
    year: 2024,
    url: "https://www.nature.com/articles/s41467-024-45812-z",
    role: "Empirical context for timbre-dependent consonance; app proxies are not calibrated replicas.",
  },
  {
    id: "snyder-2024",
    title: "Theoretical and empirical advances in understanding musical rhythm, beat and metre",
    authors: "Snyder and colleagues",
    year: 2024,
    url: "https://www.nature.com/articles/s44159-024-00315-y",
    role: "Current review context for rhythm, beat, and metre beyond onset-vector computations.",
  },
  {
    id: "frederick-2023",
    title: "Diatonic Voice-Leading Transformations",
    authors: "Leah Frederick",
    year: 2023,
    url: "https://doi.org/10.1093/mts/mtad017",
    role: "Music-theory context for transformational and voice-leading spaces.",
  },
  {
    id: "demos-palmer-2023",
    title: "Social and nonlinear dynamics unite: Musical group synchrony",
    authors: "Demos and Palmer",
    year: 2023,
    url: "https://doi.org/10.1016/j.tics.2023.05.005",
    role: "Empirical and theoretical context for emergent group synchrony beyond pairwise phase models.",
  },
  {
    id: "abalde-2024",
    title: "A framework for joint music making: Behavioral findings, neural processes, and computational models",
    authors: "Abalde and colleagues",
    year: 2024,
    url: "https://doi.org/10.1016/j.neubiorev.2024.105816",
    role: "Frames coordination alongside knowledge, goals, strategies, and social factors.",
  },
  {
    id: "w3c-webaudio",
    title: "Web Audio API",
    authors: "W3C Web Audio Working Group",
    year: 2024,
    url: "https://www.w3.org/TR/webaudio/",
    role: "Normative browser audio-processing interface used by the local pipeline.",
  },
  {
    id: "w3c-mediacapture",
    title: "Media Capture and Streams",
    authors: "W3C WebRTC Working Group",
    year: 2025,
    url: "https://www.w3.org/TR/mediacapture-streams/",
    role: "Normative media-capture interface and constraint behavior.",
  },
];

const sourceIndex = new Map(researchSources.map((source) => [source.id, source]));

export function sourceById(id: string): ResearchSource | undefined {
  return sourceIndex.get(id);
}
