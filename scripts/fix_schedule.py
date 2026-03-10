"""
fix_schedule.py — إصلاح ملف CSV جدولة المنشورات تلقائياً
الاستخدام: python3 fix_schedule.py input.csv output.csv

يقوم بـ:
1. إزالة الصفوف الفارغة تماماً
2. دمج الصفوف المكررة بنفس Date+Time
3. التحقق من صحة روابط الصور والفيديوهات
4. تحويل الترميز إلى UTF-8 with BOM
5. إنشاء نسخة Single-Platform إذا لزم الأمر
"""

import pandas as pd
import sys
import requests
from pathlib import Path


def check_url(url, timeout=5):
    """التحقق من أن الرابط يعمل بشكل صحيح"""
    if not url or str(url).strip() == '' or str(url).lower() == 'nan':
        return False
    try:
        response = requests.head(str(url), timeout=timeout, allow_redirects=True)
        return response.status_code == 200
    except Exception:
        # محاولة GET إذا فشل HEAD
        try:
            response = requests.get(str(url), timeout=timeout, allow_redirects=True, stream=True)
            return response.status_code == 200
        except Exception:
            return False


def validate_media_urls(df):
    """التحقق من صحة جميع روابط الصور والفيديوهات"""
    image_cols = [c for c in df.columns if 'Image' in c or 'image' in c]
    video_cols = [c for c in df.columns if 'Video' in c or 'video' in c]
    
    print("\n🔍 فحص روابط الوسائط...")
    
    for col in image_cols + video_cols:
        if col in df.columns:
            invalid_count = 0
            for idx, url in enumerate(df[col]):
                if pd.notna(url) and str(url).strip() != '':
                    if not check_url(url):
                        print(f"⚠️  رابط غير صحيح في {col} (صف {idx+2}): {url}")
                        invalid_count += 1
            if invalid_count > 0:
                print(f"⚠️  {invalid_count} رابط غير صحيح في عمود {col}")


def fix_csv(input_path, output_path, validate_urls=False):
    """إصلاح ملف CSV"""
    try:
        # قراءة الملف
        df = pd.read_csv(input_path, encoding='utf-8-sig')
        original_cols = list(df.columns)
        
        print(f"✓ قراءة الملف: {len(df)} صف، {len(df.columns)} عمود")
        print(f"  الأعمدة: {', '.join(original_cols)}")
        
        # إزالة الصفوف الفارغة تماماً
        post_cols = [c for c in df.columns if 'Post' in c or 'post' in c]
        if post_cols:
            df = df[df[post_cols].apply(
                lambda x: x.astype(str).str.strip().ne(''), axis=1
            ).any(axis=1)]
            print(f"✓ بعد إزالة الصفوف الفارغة: {len(df)} صف")
        
        # دمج الصفوف المكررة بنفس Date+Time
        if 'Date' in df.columns and 'Time' in df.columns:
            def merge_group(group):
                merged = {}
                for col in group.columns:
                    if col not in ['Date', 'Time']:
                        vals = group[col][
                            group[col].notna() & 
                            (group[col].astype(str).str.strip() != '') &
                            (group[col].astype(str) != 'nan')
                        ].tolist()
                        merged[col] = vals[0] if vals else ''
                    else:
                        merged[col] = group[col].iloc[0]
                return pd.Series(merged)
            
            fixed = df.groupby(['Date', 'Time'], sort=False).apply(
                merge_group, include_groups=False
            ).reset_index(drop=True)
            
            print(f"✓ بعد دمج المكررات: {len(fixed)} صف")
            df = fixed
        
        # التحقق من صحة الروابط إذا طُلب ذلك
        if validate_urls:
            validate_media_urls(df)
        
        # إعادة الترتيب
        df = df[[c for c in original_cols if c in df.columns]]
        
        # حفظ
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        print(f"✅ تم الحفظ: {output_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ خطأ: {e}")
        return False


def convert_to_single_platform(input_path, output_path):
    """تحويل من Multi-Platform إلى Single-Platform"""
    try:
        df = pd.read_csv(input_path, encoding='utf-8-sig')
        
        platforms = {
            'Facebook': {'post': 'Facebook Post', 'image': 'Facebook Image', 'video': 'Facebook Video'},
            'Instagram': {'post': 'Instagram Post', 'image': 'Instagram Image', 'video': 'Instagram Video'},
            'Threads': {'post': 'Threads Post', 'image': 'Threads Image', 'video': 'Threads Video'},
            'Twitter': {'post': 'Twitter Post', 'image': 'Twitter Image', 'video': 'Twitter Video'},
            'LinkedIn': {'post': 'LinkedIn Post', 'image': 'LinkedIn Image', 'video': 'LinkedIn Video'},
            'Pinterest': {'post': 'Pinterest Post', 'image': 'Pinterest Image', 'video': 'Pinterest Video'},
            'TikTok': {'post': 'TikTok Post', 'image': 'TikTok Image', 'video': 'TikTok Video'},
            'Telegram': {'post': 'Telegram Post', 'image': 'Telegram Image', 'video': 'Telegram Video'},
            'YouTube': {'post': 'YouTube Post', 'image': 'YouTube Image', 'video': 'YouTube Video'},
        }
        
        rows = []
        for _, row in df.iterrows():
            for platform, cols in platforms.items():
                post = str(row.get(cols['post'], '')).strip()
                if post and post != 'nan':
                    rows.append({
                        'Date': row.get('Date', ''),
                        'Time': row.get('Time', ''),
                        'Platform': platform,
                        'Post': post,
                        'Image': str(row.get(cols['image'], '')).strip(),
                        'Video': str(row.get(cols['video'], '')).strip(),
                    })
        
        single_df = pd.DataFrame(rows)
        single_df.to_csv(output_path, index=False, encoding='utf-8-sig')
        print(f"✅ تم التحويل إلى Single-Platform: {output_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ خطأ في التحويل: {e}")
        return False


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
        validate = '--validate' in sys.argv
        fix_csv(input_file, output_file, validate_urls=validate)
    else:
        print("الاستخدام:")
        print("  python3 fix_schedule.py input.csv output.csv [--validate]")
        print("\nمثال:")
        print("  python3 fix_schedule.py tomford_schedule.csv tomford_fixed.csv --validate")
