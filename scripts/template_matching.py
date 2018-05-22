import cv2
import numpy as np
from matplotlib import pyplot as plt
import re
import sys
# np.set_printoptions(threshold=np.nan)

chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-']

templates = [cv2.imread('../ocr-data/' + char + '.png',cv2.IMREAD_UNCHANGED) for char in chars]
templates = [template[...,-1] for template in templates]

def getPositions(img, template, char):
  # char only for debug
  res = cv2.matchTemplate(img,template,eval('cv2.TM_CCOEFF_NORMED'))
  # res only has 1 row
  results = [idx for idx, val in enumerate(res[0]) if val >= 0.999]
  return results

def getString(img):
  res = []
  for (char, template) in zip(chars, templates):
    for idx in getPositions(img, template, char):
      res.append({'char': char, 'idx': idx})
  res = sorted(res, key=lambda k:k['idx'])
  return ''.join([k['char'] for k in res])

def solveCaptcha(val):
  first, second = re.split(r'[\+,-]',val)
  if '+' in val:
    return int(first) + int(second)
  else:
    return int(first) - int(second)

img = cv2.imread(sys.argv[1],cv2.IMREAD_UNCHANGED)
img = img[...,-1]

val = getString(img)
print solveCaptcha(val)
# img2 = img.copy()
# template = cv2.imread('../ocr-data/-.png',cv2.IMREAD_UNCHANGED)
# template = template[...,-1]
# print template.shape
# w, h = template.shape[::-1]



# # All the 6 methods for comparison in a list
# methods = ['cv2.TM_CCOEFF_NORMED', 'cv2.TM_CCORR',
#             'cv2.TM_CCORR_NORMED', 'cv2.TM_SQDIFF', 'cv2.TM_SQDIFF_NORMED']

# for meth in methods:
#   img = img2.copy()
#   method = eval(meth)

#   # Apply template Matching
#   res = cv2.matchTemplate(img,template,method)
#   print res
#   min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)

#   # If the method is TM_SQDIFF or TM_SQDIFF_NORMED, take minimum
#   if method in [cv2.TM_SQDIFF, cv2.TM_SQDIFF_NORMED]:
#       top_left = min_loc
#   else:
#       top_left = max_loc
#   bottom_right = (top_left[0] + w, top_left[1] + h)

#   cv2.rectangle(img,top_left, bottom_right, 255, 2)

#   plt.subplot(121),plt.imshow(res,cmap = 'gray')
#   plt.title('Matching Result'), plt.xticks([]), plt.yticks([])
#   plt.subplot(122),plt.imshow(img,cmap = 'gray')
#   plt.title('Detected Point'), plt.xticks([]), plt.yticks([])
#   plt.suptitle(meth)

#   plt.show()