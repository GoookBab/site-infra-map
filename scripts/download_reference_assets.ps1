$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $workspace 'assets\facilities'
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
$headers = @{ 'User-Agent' = 'Mozilla/5.0' }

$assets = @(
  @{ Name = 'munjeong_park.jpg'; Url = 'https://parks.seoul.go.kr/file/info/view.do?fIdx=1537' },
  @{ Name = 'songpa_youth.jpg'; Url = 'https://file2.nocutnews.co.kr/newsroom/image/2020/06/30/20200630114253126194_6_710_473.jpg' },
  @{ Name = 'badminton.jpg'; Url = 'https://sports.seoul.go.kr/file/view/FID00000477/0.do' },
  @{ Name = 'geulmaru_library.jpg'; Url = 'https://cloudfront-ap-northeast-1.images.arcpublishing.com/chosun/O4C6MSUDPMMRP7WLUN57UFL4HE.jpg' },
  @{ Name = 'megabox_parkhabio.jpg'; Url = 'https://media.triple.guide/triple-cms/c_limit%2Cf_auto%2Ch_1024%2Cw_1024/eb849a70-f90c-43e2-9bb2-047a8031631e.jpeg' },
  @{ Name = 'garden5.jpg'; Url = 'https://www.songpa.go.kr/upload/DATA/resrce/3769e63e-3b29-4453-b2a6-7e612b5074b5DG7AC76G499A806E.jpg' }
)

foreach ($asset in $assets) {
  $destination = Join-Path $targetDir $asset.Name
  Invoke-WebRequest -Uri $asset.Url -Headers $headers -OutFile $destination
  $item = Get-Item -LiteralPath $destination
  if ($item.Length -lt 1000) {
    throw "Downloaded asset is unexpectedly small: $($asset.Name)"
  }
  Write-Host "Downloaded $($item.Name) ($($item.Length) bytes)"
}

