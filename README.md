# Site Infrastructure Map Skill

한국 건축 프로젝트의 주변 인프라를 `웹 리서치 주소 → VWorld 좌표 → PNU/필지 검증 → 반경 필터 → 위성영상 QA` 순서로 처리하는 재사용 가능한 Codex Skill입니다. Codex에는 이 GitHub 저장소 URL을 주고 설치를 요청한 뒤 `$site-infra-map`으로 호출할 수 있습니다.

웹 리서치에서 얻은 **시설명과 주소**를 공인 공간정보에 연결해, 위성지도 위에 재현 가능한 좌표로 저장하는 1차 데이터 파이프라인입니다.

현재 범위는 데이터 구축과 좌표 정합성 확인용 위성 QA 지도까지입니다.

1. 시설명·카테고리·주소 CSV 입력
2. 주소 정규화
3. VWorld 주소 지오코딩(WGS84)
4. 연속지적도에서 PNU와 필지 도형 확인
5. 대상지 반경 계산
6. 좌표 출처와 검증 상태를 SQLite에 저장
7. 동일한 Web Mercator 타일 좌표계로 VWorld 위성영상에 필지·핀·반경 중첩

## 입력 CSV

UTF-8 CSV의 필수 열은 `name`, `category`, `address`입니다. `source_url`은 선택입니다.

```csv
name,category,address,source_url
연남동 주민센터,public,서울특별시 마포구 성미산로29길 17-9,https://example.com/source
```

## 사용

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -e .
python scripts/site_infra.py init-db --db data/site_infra.sqlite3
python scripts/site_infra.py set-site --db data/site_infra.sqlite3 --address "서울특별시 송파구 법원로8길 8" --radius-m 2000
python scripts/site_infra.py import-csv --db data/site_infra.sqlite3 --csv research.csv
python scripts/site_infra.py geocode --db data/site_infra.sqlite3 --site-lat 37.5665 --site-lon 126.9780 --radius-m 2000
python scripts/site_infra.py export-csv --db data/site_infra.sqlite3 --output outputs/facilities.csv
python scripts/site_infra.py render-map --db data/site_infra.sqlite3 --output outputs/satellite_qa_overview.png --zoom 16
python scripts/site_infra.py render-map --db data/site_infra.sqlite3 --output outputs/satellite_qa_site_detail.png --zoom 19 --view-radius-m 180
```

`geocode` 실행 전 `.env.example`을 복사해 프로젝트 루트에 `.env`를 만들고
`VWORLD_API_KEY`, `VWORLD_DOMAIN`을 설정합니다. `.env`는 Git에서 제외되며 키는
DB나 출력 CSV에 저장되지 않습니다. 운영 환경에서는 파일 대신 시스템 환경변수를
사용해도 됩니다.

키는 [VWorld 인증키 발급](https://www.vworld.kr/dev/v4dv_apikey_s002.do)에서 신청합니다. 회원가입·로그인 후 **오픈API → 인증키 발급**에서 개발용 키와 호출 도메인을 등록하고, 로컬 실행이라면 등록값과 `.env`의 `VWORLD_DOMAIN`을 동일하게 맞춥니다.

## 정확도 등급

- `parcel_verified`: 주소 좌표가 조회된 필지 도형 내부에 있음
- `address_matched`: 주소 좌표는 확보했지만 필지 검증은 수행하지 못함
- `review_required`: 좌표가 필지 밖에 있거나 응답이 불완전함
- `not_found`: 주소 지오코딩 실패

학교·주민센터·도서관처럼 단일 건물 시설은 다음 단계에서 건물 폴리곤/건물관리번호 검증을 추가합니다. 공원·대학·병원·지하철역은 대표점의 의미가 다르므로 별도 앵커 정책을 적용해야 합니다.

## 공식 데이터 연결

- 주소 지오코딩 및 2D 공간 데이터: [VWorld 개발자센터](https://www.vworld.kr/dev/v4dv_geocoderguide2_s001.do)
- 필지 검증 레이어: VWorld `LP_PA_CBND_BUBUN` 연속지적도
- 위성영상: VWorld WMTS `Satellite` 레이어
- 장기 로컬 DB 후보: [주소기반산업지원서비스](https://m1.juso.go.kr/addrlink/main.do)의 도로명주소·전자지도 데이터
