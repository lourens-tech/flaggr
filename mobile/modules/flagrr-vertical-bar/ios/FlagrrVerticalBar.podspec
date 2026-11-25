Pod::Spec.new do |s|
  s.name           = 'FlagrrVerticalBar'
  s.version        = '1.0.0'
  s.summary        = 'Reports where iOS places the vertical bar (iPhone Duo strip).'
  s.description    = 'Local Expo module for Flagrr: reads UITraitCollection.verticalBarEdge (iOS 27.1+).'
  s.license        = 'UNLICENSED'
  s.author         = 'Flagrr'
  s.homepage       = 'https://flagrr.co.za'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
