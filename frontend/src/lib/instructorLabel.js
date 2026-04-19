/** instructor_profiles.public_label: 'instructor' | 'trainer' */
export function instructorRoleAz(publicLabel) {
  return publicLabel === 'trainer' ? 'Təlimçi' : 'Müəllim'
}

/** Sizə müraciət: «Müəlliminiz» / «Təlimçiniz» */
export function instructorYourForm(publicLabel) {
  return publicLabel === 'trainer' ? 'Təlimçiniz' : 'Müəlliminiz'
}
