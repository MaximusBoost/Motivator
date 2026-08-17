import engineeringImage from "~/images/engineer.svg";
import firearmsImage from "~/images/fire_training.svg";
import medicalImage from "~/images/medical.svg";
import regulationsImage from "~/images/ustav.svg";
import rhbImage from "~/images/rhbz.svg";
import tacticsImage from "~/images/tactical_training.svg";
import topographyImage from "~/images/topography.svg";

const subjectImages: Record<string, string> = {
  engineering: engineeringImage,
  firearms: firearmsImage,
  medical: medicalImage,
  regulations: regulationsImage,
  rhb: rhbImage,
  tactics: tacticsImage,
  topography: topographyImage,
};

export function getSubjectImage(subjectId: string): string | undefined {
  return subjectImages[subjectId];
}
