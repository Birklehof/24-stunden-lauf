import React from 'react';
import { useSession } from 'next-auth/react';
import Layout from '../../components/layout';
import { prisma } from '../../../prisma';
import { Lap, Runner } from '@prisma/client';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement);

const houseNames = process.env.HOUSES?.split(',') || ['Extern'];
const gradeNames = process.env.GRADES?.split(',') || ['Keine Klasse'];
const metersPerLap = parseInt(process.env.METERS_PER_LAP || '660');

interface RunnerWitLapsAndLapCount extends Runner {
  laps: Lap[];
  _count: {
    laps: number;
  };
}

export async function getServerSideProps(_context: any) {
  let runners = await prisma.runner.findMany({
    include: {
      laps: true,
      _count: {
        select: {
          laps: true
        }
      }
    },
    orderBy: [
      {
        laps: {
          _count: 'desc'
        }
      },
      {
        number: 'desc'
      }
    ]
  });
  let firstLap = await prisma.lap.findFirst({
    orderBy: {
      runAt: 'asc'
    }
  });
  runners = JSON.parse(JSON.stringify(runners));
  firstLap = JSON.parse(JSON.stringify(firstLap));
  return { props: { runners, firstLap } };
}

export default function GeneralPage({ runners, firstLap }: { runners: RunnerWitLapsAndLapCount[]; firstLap: Lap }) {
  const { status } = useSession();
  const loading = status === 'loading';

  let hoursSinceFirstLap = 0;
  if (firstLap) {
    hoursSinceFirstLap = Math.floor((Date.now() - new Date(firstLap.runAt).getTime()) / 1000 / 60 / 60);
  }
  hoursSinceFirstLap = hoursSinceFirstLap < 2 ? 2 : hoursSinceFirstLap;
  const totalLapsInEachHourSinceFirstLap = Array.from({ length: hoursSinceFirstLap }, (_, i) => {
    const hour = i + 1;
    const lapsInHour = runners.reduce((acc, runner) => {
      const lapsInHour = runner.laps.filter((lap) => {
        const lapHour = Math.floor(
          (new Date(lap.runAt).getTime() - new Date(runners[0].laps[0].runAt).getTime()) / 1000 / 60 / 60
        );
        return lapHour <= hour;
      });
      return acc + lapsInHour.length;
    }, 0);
    return lapsInHour;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const lapsPerHour = hours.map((hour) => {
    return runners.reduce((acc, runner) => {
      return acc + runner.laps.filter((lap) => new Date(lap.runAt).getHours() === hour).length;
    }, 0);
  });
  const averageLapsPerRunner =
    runners.reduce((acc, runner) => {
      return acc + runner.laps.length;
    }, 0) / runners.length;

  const houses = houseNames.map((name) => {
    return {
      name,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      _count: {
        laps: runners.filter((runner) => runner.house === name).reduce((sum, runner) => sum + runner._count.laps, 0)
      },
      averageLaps:
        runners.filter((runner) => runner.house === name).reduce((sum, runner) => sum + runner.laps.length, 0) /
        runners.filter((runner) => runner.house === name).length
    };
  });

  const grades = gradeNames.map((name) => {
    return {
      name,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      _count: {
        laps: runners.filter((runner) => runner.grade === name).reduce((sum, runner) => sum + runner._count.laps, 0)
      },
      averageLaps:
        runners.filter((runner) => runner.grade === name).reduce((sum, runner) => sum + runner.laps.length, 0) /
        runners.filter((runner) => runner.grade === name).length
    };
  });

  const addAlpha = (color: string, alpha: number) => {
    return color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  };

  // When rendering client side don't display anything until loading is complete
  if (typeof window !== 'undefined' && loading) return null;

  return (
    <Layout>
      <div className="card w-11/12 max-w-4xl bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Übersicht</h2>
          <div className="stats stats-vertical lg:stats-horizontal mb-2">
            <div className="stat place-items-center">
              <div className="stat-title">Teilnehmer</div>
              <div className="stat-value">{runners.length}</div>
            </div>

            <div className="stat place-items-center">
              <div className="stat-title">Runden gesamt</div>
              <div className="stat-value">
                {runners.reduce((acc, runner) => acc + Number(runner.laps.length) || 0, 0)}
              </div>
            </div>

            <div className="stat place-items-center">
              <div className="stat-title">Runden pro Teilnehmer</div>
              <div className="stat-value">Ø {Math.round(averageLapsPerRunner || 0)}</div>
            </div>
          </div>
          <div className="stats stats-vertical lg:stats-horizontal">
            <div className="stat place-items-center">
              <div className="stat-title">Gesamtstrecke</div>
              <div className="stat-value">
                {Math.round((runners.length * averageLapsPerRunner * metersPerLap) / 1000 || 0)} km
              </div>
              <div className="stat-desc">{metersPerLap}m pro Runde</div>
            </div>

            <div className="stat place-items-center">
              <div className="stat-title">Strecke pro Teilnehmer</div>
              <div className="stat-value">Ø {Math.round(averageLapsPerRunner * 0.6 * 10) / 10 || 0} km</div>
            </div>
          </div>
          <br />
          <div>
            <h3 className="card-title">Gesamtrundenzahl seit Start</h3>
            <Line
              data={{
                labels: Array.from({ length: hoursSinceFirstLap }, (_, i) => i),
                datasets: [
                  {
                    label: 'Runden',
                    data: totalLapsInEachHourSinceFirstLap,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    tension: 0.5
                  }
                ]
              }}
            />
          </div>
          <div>
            <h3 className="card-title">Runden über den Tagesverlauf</h3>
            <Line
              datasetIdKey="id"
              data={{
                labels: hours.map((hour) => `${hour}:00`),
                datasets: [
                  {
                    label: 'Runden über den Tagesverlauf',
                    data: lapsPerHour,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    tension: 0.3
                  },
                  {
                    label: 'Durchschnittliche Runden pro Teilnehmer',
                    data: Array.from({ length: 24 }, () => Math.round(averageLapsPerRunner)),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    tension: 0.1
                  }
                ]
              }}
            />
          </div>
          <br />
          <h3 className="card-title">Häuser</h3>
          <div className="flex flex-col w-full justify-around items-center gap-4 max-w-lg mx-auto lg:flex-row lg:m-0 lg:max-w-none">
            <div className="hidden lg:block">
              <Doughnut
                datasetIdKey="id"
                width={400}
                data={{
                  labels: houses.map((house) => house.name),
                  datasets: [
                    {
                      label: 'Runden pro Gruppe',
                      data: houses.map((house) => house._count.laps),
                      backgroundColor: houses.map((house) => addAlpha(house.color, 0.2)),
                      borderColor: houses.map((house) => house.color),
                      borderWidth: 2
                    }
                  ]
                }}
                options={{
                  plugins: {
                    legend: {
                      position: 'left'
                    }
                  }
                }}
              />
            </div>
            <div className="block lg:hidden">
              <Doughnut
                datasetIdKey="id"
                width={200}
                height={200}
                data={{
                  labels: houses.map((house) => house.name),
                  datasets: [
                    {
                      label: 'Runden pro Gruppe',
                      data: houses.map((house) => house._count.laps),
                      backgroundColor: houses.map((house) => addAlpha(house.color, 0.2)),
                      borderColor: houses.map((house) => house.color),
                      borderWidth: 2
                    }
                  ]
                }}
                options={{
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }}
              />
            </div>
            <div>
              <Bar
                datasetIdKey="id"
                data={{
                  labels: houses.map((house) => house.name),
                  datasets: [
                    {
                      label: 'Ø Runden pro Haus',
                      data: houses.map((house) => house.averageLaps),
                      backgroundColor: houses.map((house) => addAlpha(house.color, 0.2)),
                      borderColor: houses.map((house) => house.color),
                      borderWidth: 2
                    }
                  ]
                }}
                options={{
                  scales: {
                    x: {
                      display: false
                    }
                  },
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }}
              />
            </div>
          </div>
          <br />
          <h3 className="card-title">Klassen</h3>
          <div className="flex flex-col w-full justify-around items-center gap-4 max-w-lg mx-auto lg:flex-row lg:m-0 lg:max-w-none">
            <div className="hidden lg:block">
              <Doughnut
                datasetIdKey="id"
                width={400}
                data={{
                  labels: grades.map((grade) => grade.name),
                  datasets: [
                    {
                      label: 'Runden pro Klasse',
                      data: grades.map((grade) => grade._count.laps),
                      backgroundColor: grades.map((grade) => addAlpha(grade.color, 0.2)),
                      borderColor: grades.map((grade) => grade.color),
                      borderWidth: 2
                    }
                  ]
                }}
                options={{
                  plugins: {
                    legend: {
                      position: 'left'
                    }
                  }
                }}
              />
            </div>
            <div className="block lg:hidden">
              <Doughnut
                datasetIdKey="id"
                width={200}
                height={200}
                data={{
                  labels: grades.map((grade) => grade.name),
                  datasets: [
                    {
                      label: 'Runden pro Gruppe',
                      data: grades.map((grade) => grade._count.laps),
                      backgroundColor: grades.map((grade) => addAlpha(grade.color, 0.2)),
                      borderColor: grades.map((grade) => grade.color),
                      borderWidth: 2
                    }
                  ]
                }}
                options={{
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }}
              />
            </div>
            <div>
              <Bar
                datasetIdKey="id"
                data={{
                  labels: grades.map((grade) => grade.name),
                  datasets: [
                    {
                      label: 'Ø Runden pro Haus',
                      data: grades.map((grade) => grade.averageLaps),
                      backgroundColor: grades.map((grade) => addAlpha(grade.color, 0.2)),
                      borderColor: grades.map((grade) => grade.color),
                      borderWidth: 2
                    }
                  ]
                }}
                options={{
                  scales: {
                    x: {
                      display: false
                    }
                  },
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
