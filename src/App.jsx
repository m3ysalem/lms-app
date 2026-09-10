import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { RequireAuth, RequireAdmin } from './components/Guards'
import Layout from './components/Layout'

import Login from './routes/auth/Login'
import Dashboard from './routes/employee/Dashboard'
import Courses from './routes/employee/Courses'
import MyLearning from './routes/employee/MyLearning'
import CoursePlayer from './routes/employee/CoursePlayer'
import Quiz from './routes/employee/Quiz'
import Certificates from './routes/employee/Certificates'
import Profile from './routes/employee/Profile'

import AdminDashboard from './routes/admin/Dashboard'
import AdminEmployees from './routes/admin/Employees'
import AdminCourses from './routes/admin/Courses'
import AdminCourseBuilder from './routes/admin/CourseBuilder'
import AdminAssignments from './routes/admin/Assignments'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Employee-facing (any authenticated role can view their own learning) */}
      <Route path="/" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
      <Route path="/courses" element={<RequireAuth><Layout><Courses /></Layout></RequireAuth>} />
      <Route path="/courses/:courseId" element={<RequireAuth><Layout><CoursePlayer /></Layout></RequireAuth>} />
      <Route path="/courses/:courseId/quiz" element={<RequireAuth><Layout><Quiz /></Layout></RequireAuth>} />
      <Route path="/my-learning" element={<RequireAuth><Layout><MyLearning /></Layout></RequireAuth>} />
      <Route path="/certificates" element={<RequireAuth><Layout><Certificates /></Layout></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Layout><Profile /></Layout></RequireAuth>} />

      {/* Admin-only */}
      <Route path="/admin" element={<RequireAuth><RequireAdmin><Layout><AdminDashboard /></Layout></RequireAdmin></RequireAuth>} />
      <Route path="/admin/employees" element={<RequireAuth><RequireAdmin><Layout><AdminEmployees /></Layout></RequireAdmin></RequireAuth>} />
      <Route path="/admin/courses" element={<RequireAuth><RequireAdmin><Layout><AdminCourses /></Layout></RequireAdmin></RequireAuth>} />
      <Route path="/admin/courses/:courseId" element={<RequireAuth><RequireAdmin><Layout><AdminCourseBuilder /></Layout></RequireAdmin></RequireAuth>} />
      <Route path="/admin/assignments" element={<RequireAuth><RequireAdmin><Layout><AdminAssignments /></Layout></RequireAdmin></RequireAuth>} />

      <Route path="*" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
    </Routes>
  )
}
