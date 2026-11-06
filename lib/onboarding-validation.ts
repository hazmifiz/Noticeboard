export type OnboardingValidation = {
  fullName: string;
  programmeId: string;
  semester: number;
};

export function validateOnboarding(
  formData: FormData
): OnboardingValidation {
  const rawFullName = formData.get('full_name');
  const rawProgrammeId = formData.get('programme_id');
  const rawSemester = formData.get('semester');

  // 1. Validate full name
  if (
    typeof rawFullName !== 'string' ||
    !rawFullName.trim()
  ) {
    throw new Error('Please enter your full name.');
  }

  const fullName = rawFullName.trim();

  if (fullName.length < 2) {
    throw new Error(
      'Your full name must contain at least 2 characters.'
    );
  }

  if (fullName.length > 100) {
    throw new Error(
      'Your full name cannot exceed 100 characters.'
    );
  }

  // 2. Validate programme
  if (
    typeof rawProgrammeId !== 'string' ||
    !rawProgrammeId.trim()
  ) {
    throw new Error('Please select your programme.');
  }

  // 3. Validate semester
  if (
    typeof rawSemester !== 'string' ||
    !/^[1-9]$/.test(rawSemester)
  ) {
    throw new Error(
      'Please select a semester between 1 and 6.'
    );
  }

  return {
    fullName,
    programmeId: rawProgrammeId,
    semester: Number(rawSemester),
  };
}