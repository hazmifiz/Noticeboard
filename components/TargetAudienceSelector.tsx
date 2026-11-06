'use client';

import { useState } from 'react';
import { useEffect } from 'react';

type Programme = {
  id: string;
  code: string;
  name: string;
};

type Props = {
  programmes: Programme[];
  initialAudienceType?: 'all' | 'targeted';
  initialProgrammeIds?: string[];
  initialSemesters?: number[];
};

export default function TargetAudienceSelector({
  programmes,
  initialAudienceType = 'all',
  initialProgrammeIds = [],
  initialSemesters = [],
}: Props) {
  const [audienceType, setAudienceType] = useState<
    'all' | 'targeted'
  >(initialAudienceType);

  const [selectedProgrammes, setSelectedProgrammes] =
    useState<string[]>(initialProgrammeIds);

  const [selectedSemesters, setSelectedSemesters] =
    useState<number[]>(initialSemesters);

  const [showErrors, setShowErrors] = useState(false);

  const missingProgrammes =
    audienceType === 'targeted' &&
    selectedProgrammes.length === 0;

  const missingSemesters =
    audienceType === 'targeted' &&
    selectedSemesters.length === 0;

  function toggleProgramme(id: string) {
    setSelectedProgrammes((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  function toggleSemester(semester: number) {
    setSelectedSemesters((current) =>
      current.includes(semester)
        ? current.filter((value) => value !== semester)
        : [...current, semester]
    );
  }

  useEffect(() => {
    function handleInvalidAudience() {
        setShowErrors(true);
    }

    window.addEventListener(
        'announcement-audience-invalid',
        handleInvalidAudience
    );

    return () => {
        window.removeEventListener(
        'announcement-audience-invalid',
        handleInvalidAudience
        );
    };
    }, []);

  return (
    <div
      data-audience-selector
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-800">
          Target Audience
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Choose which students can view this announcement.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="radio"
          name="audience_type"
          value="all"
          checked={audienceType === 'all'}
          onChange={() => {
            setAudienceType('all');
            setShowErrors(false);
          }}
        />
        All Students
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="radio"
          name="audience_type"
          value="targeted"
          checked={audienceType === 'targeted'}
          onChange={() => setAudienceType('targeted')}
        />
        Specific Programmes and Semesters
      </label>

      {audienceType === 'targeted' && (
        <div className="space-y-5 border-t border-slate-200 pt-4">
          {/* Programmes */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              Select Programmes
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {programmes.map((programme) => (
                <label
                  key={programme.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="target_programmes"
                    value={programme.id}
                    checked={selectedProgrammes.includes(programme.id)}
                    onChange={() => toggleProgramme(programme.id)}
                  />
                  <span>
                    {programme.code} - {programme.name}
                  </span>
                </label>
              ))}
            </div>

            {showErrors && missingProgrammes && (
              <p
                role="alert"
                className="text-sm font-medium text-red-600"
              >
                Please select at least one programme.
              </p>
            )}
          </div>

          {/* Semesters */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              Select Semesters
            </p>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((semester) => (
                <label
                  key={semester}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="target_semesters"
                    value={semester}
                    checked={selectedSemesters.includes(semester)}
                    onChange={() => toggleSemester(semester)}
                  />
                  Sem {semester}
                </label>
              ))}
            </div>

            {showErrors && missingSemesters && (
              <p
                role="alert"
                className="text-sm font-medium text-red-600"
              >
                Please select at least one semester.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Validation trigger controlled by the parent form */}
      <input
        type="hidden"
        data-audience-valid={
          !missingProgrammes && !missingSemesters
            ? 'true'
            : 'false'
        }
      />
    </div>
  );
}