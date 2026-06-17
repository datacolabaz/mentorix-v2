const {
  transferStudentBetweenGroups,
  getTransferPreview,
} = require('../services/studentGroupTransferService');

const postTransferStudent = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const {
      enrollment_id,
      student_id,
      source_group_id,
      target_group_id,
      pricing_mode,
      schedule_effective,
    } = req.body || {};

    const result = await transferStudentBetweenGroups({
      instructorId,
      enrollmentId: enrollment_id,
      studentId: student_id,
      sourceGroupId: source_group_id,
      targetGroupId: target_group_id,
      pricingMode: pricing_mode,
      scheduleEffective: schedule_effective,
    });

    res.json({
      success: true,
      message: `${result.student_name} uğurla "${result.target_group_name}" qrupuna köçürüldü`,
      ...result,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      message: err.message || 'Köçürmə alınmadı',
      code: err.code || null,
    });
  }
};

const getTransferStudentPreview = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const targetGroupId = req.query.target_group_id;
    if (!targetGroupId) {
      return res.status(400).json({ success: false, message: 'target_group_id tələb olunur' });
    }
    const preview = await getTransferPreview(instructorId, targetGroupId);
    res.json({ success: true, ...preview });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      message: err.message || 'Önizləmə alınmadı',
      code: err.code || null,
    });
  }
};

module.exports = {
  postTransferStudent,
  getTransferStudentPreview,
};
