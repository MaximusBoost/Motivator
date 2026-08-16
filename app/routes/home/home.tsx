import { IconArea } from "~/secondApp/components/IconArea/IconArea";
import type { Route } from "./+types/home";
import { ContinueCard } from "~/secondApp/components/ContinueCard/ContinueCard";
import { learningRepository } from "~/data/learning";
import { StartCard } from "~/secondApp/components/StartCard/StartCard";
import { TodayPlan } from "~/secondApp/components/TodayPlan/TodayPlan";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Motivator" },
    { name: "description", content: "Motivator web application" },
  ];
}

const dashboard = await learningRepository.getDashboard();
const current = dashboard.continueLearning;
const todayPlan = dashboard.todayPlan;

export default function Home() {
  console.log(dashboard);
  return (
    <main>
      <ContinueCard
        nameSubject={current?.subjectTitle}
        contuniueQuest={current?.nextActivityTitle}
        nameModule={current?.moduleTitle}
        firstSerialNumber={current?.moduleNumber}
        secondSerialNumber={current?.modulesTotal}
        percent={current?.progressPercent ?? 0}
      />

      <StartCard count="74" smallText="хуй знает что"/>
      <TodayPlan items={todayPlan}/>
    </main>
  );
}
